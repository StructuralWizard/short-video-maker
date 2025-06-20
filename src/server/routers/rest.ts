import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import fs from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import http from 'http';

import { validateCreateShortInput } from "../validator";
import { ShortCreator } from "../../short-creator/ShortCreator";
import { logger } from "../../logger";
import { Config } from "../../config";

// todo abstract class
export class APIRouter {
  public router: express.Router;
  private shortCreator: ShortCreator;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.router = express.Router();
    this.shortCreator = shortCreator;

    this.router.use(express.json());

    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post(
      "/short-video",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const input = validateCreateShortInput(req.body);

          logger.info({ input }, "Creating short video");

          const videoId = this.shortCreator.addToQueue(
            input.scenes,
            input.config,
          );

          res.status(201).json({
            videoId,
          });
        } catch (error: unknown) {
          logger.error(error, "Error validating input");

          // Handle validation errors specifically
          if (error instanceof Error && error.message.startsWith("{")) {
            try {
              const errorData = JSON.parse(error.message);
              res.status(400).json({
                error: "Validation failed",
                message: errorData.message,
                missingFields: errorData.missingFields,
              });
              return;
            } catch (parseError: unknown) {
              logger.error(parseError, "Error parsing validation error");
            }
          }

          // Fallback for other errors
          res.status(400).json({
            error: "Invalid input",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    this.router.get(
      "/short-video/:videoId/status",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            logger.error("Status check failed: videoId is required");
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          
          logger.info({ videoId }, "Checking video status");
          const status = await this.shortCreator.status(videoId);
          logger.info({ videoId, status }, "Video status retrieved");
          
          res.status(200).json({
            status,
          });
        } catch (error) {
          logger.error({ error, videoId: req.params.videoId }, "Error checking video status");
          res.status(500).json({
            error: "Failed to check video status",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.get(
      "/music-tags",
      (req: ExpressRequest, res: ExpressResponse) => {
        res.status(200).json(this.shortCreator.ListAvailableMusicTags());
      },
    );

    this.router.get("/voices", (req: ExpressRequest, res: ExpressResponse) => {
      res.status(200).json(this.shortCreator.ListAvailableVoices());
    });

    this.router.get(
      "/short-videos",
      async (req: ExpressRequest, res: ExpressResponse) => {
        const videos = await this.shortCreator.listAllVideos();
        res.status(200).json({
          videos,
        });
      },
    );

    this.router.delete(
      "/short-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        this.shortCreator.deleteVideo(videoId);
        res.status(200).json({
          success: true,
        });
      },
    );

    this.router.post(
      "/clear-all-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          this.shortCreator.clearAllVideos();
          res.status(200).json({
            success: true,
            message: "All videos cleared successfully",
          });
        } catch (error) {
          logger.error({ error }, "Error clearing all videos");
          res.status(500).json({
            error: "Failed to clear all videos",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.get(
      "/video-data/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          
          const videoData = this.shortCreator.getVideoData(videoId);
          res.status(200).json(videoData);
        } catch (error) {
          logger.error({ error, videoId: req.params.videoId }, "Error getting video data");
          res.status(404).json({
            error: "Video data not found",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.put(
      "/video-data/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          
          const videoData = req.body;
          this.shortCreator.saveVideoData(videoId, videoData);
          
          res.status(200).json({
            success: true,
            message: "Video data saved successfully",
          });
        } catch (error) {
          logger.error({ error, videoId: req.params.videoId }, "Error saving video data");
          res.status(500).json({
            error: "Failed to save video data",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.get(
      "/search-videos",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { query, count = 10 } = req.query;
          if (!query || typeof query !== 'string') {
            res.status(400).json({
              error: "query parameter is required",
            });
            return;
          }
          
          const videos = await this.shortCreator.searchVideos(query, parseInt(count as string));
          res.status(200).json({
            videos,
            query,
            count: videos.length
          });
        } catch (error) {
          logger.error({ error, query: req.query.query }, "Error searching videos");
          res.status(500).json({
            error: "Failed to search videos",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.post(
      "/re-render-video/:videoId",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          
          await this.shortCreator.reRenderVideo(videoId);
          
          res.status(200).json({
            success: true,
            message: "Video re-rendering started",
          });
        } catch (error) {
          logger.error({ error, videoId: req.params.videoId }, "Error re-rendering video");
          res.status(500).json({
            error: "Failed to re-render video",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    );

    this.router.get(
      "/tmp/:tmpFile",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { tmpFile } = req.params;
        if (!tmpFile) {
          res.status(400).json({
            error: "tmpFile is required",
          });
          return;
        }
        const tmpFilePath = path.join(this.config.tempDirPath, tmpFile);
        if (!fs.existsSync(tmpFilePath)) {
          res.status(404).json({
            error: "tmpFile not found",
          });
          return;
        }

        if (tmpFile.endsWith(".mp3")) {
          res.setHeader("Content-Type", "audio/mpeg");
        }
        if (tmpFile.endsWith(".wav")) {
          res.setHeader("Content-Type", "audio/wav");
        }

        const tmpFileStream = fs.createReadStream(tmpFilePath);
        tmpFileStream.on("error", (error) => {
          logger.error(error, "Error reading tmp file");
          res.status(500).json({
            error: "Error reading tmp file",
            tmpFile,
          });
        });
        tmpFileStream.pipe(res);
      },
    );

    this.router.get(
      "/music/:fileName",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { fileName } = req.params;
        if (!fileName) {
          res.status(400).json({
            error: "fileName is required",
          });
          return;
        }
        const musicFilePath = path.join(this.config.musicDirPath, fileName);
        if (!fs.existsSync(musicFilePath)) {
          res.status(404).json({
            error: "music file not found",
          });
          return;
        }
        const musicFileStream = fs.createReadStream(musicFilePath);
        musicFileStream.on("error", (error) => {
          logger.error(error, "Error reading music file");
          res.status(500).json({
            error: "Error reading music file",
            fileName,
          });
        });
        musicFileStream.pipe(res);
      },
    );

    this.router.get(
      "/overlays/:fileName",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { fileName } = req.params;
        if (!fileName) {
          res.status(400).json({
            error: "fileName is required",
          });
          return;
        }
        const overlayFilePath = path.join(this.config.overlaysDirPath, fileName);
        if (!fs.existsSync(overlayFilePath)) {
          res.status(404).json({
            error: "overlay file not found",
          });
          return;
        }
        res.setHeader("Content-Type", "image/png");
        const overlayFileStream = fs.createReadStream(overlayFilePath);
        overlayFileStream.on("error", (error) => {
          logger.error(error, "Error reading overlay file");
          res.status(500).json({
            error: "Error reading overlay file",
            fileName,
          });
        });
        overlayFileStream.pipe(res);
      },
    );

    this.router.get(
      "/short-video/:videoId",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          const video = await this.shortCreator.getVideoBuffer(videoId);
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader(
            "Content-Disposition",
            `inline; filename=${videoId}.mp4`,
          );
          res.send(video);
        } catch (error: unknown) {
          logger.error(error, "Error getting video");
          res.status(404).json({
            error: "Video not found",
          });
        }
      },
    );

    const proxyOptions: Options = {
      target: 'http://localhost:8000', // Alvo padrão, mas será sobrescrito pelo router
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const src = (req as ExpressRequest).query.src as string;
        // Apenas repassa o caminho do recurso de mídia, removendo o prefixo do proxy
        return new URL(src).pathname;
      },
      router: (req) => {
        const src = (req as ExpressRequest).query.src as string;
        // Retorna a origem (protocolo, host, porta) da URL de destino
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      },
    };

    this.router.use('/proxy', createProxyMiddleware(proxyOptions));
  }
}
