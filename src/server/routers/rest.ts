import { createProxyMiddleware, Options } from "http-proxy-middleware";
import express, { Router, Request as ExpressRequest, Response as ExpressResponse } from "express";
import fs from "fs";
import path from "path";

import { ShortCreator } from "../../short-creator/ShortCreator";
import { Config } from "../../config";
import { logger } from "../../logger";
import { RenderRequest, VoiceEnum } from "../../types/shorts";
import { VideoStatusManager } from "../../short-creator/VideoStatusManager";
import { RenderConfig } from "../../types/shorts";

export class APIRouter {
  router: Router;
  private shortCreator: ShortCreator;
  private config: Config;
  private videoStatusManager: VideoStatusManager;

  constructor(config: Config, shortCreator: ShortCreator, videoStatusManager: VideoStatusManager) {
    this.router = Router();
    this.config = config;
    this.shortCreator = shortCreator;
    this.videoStatusManager = videoStatusManager;
    this.router.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get("/status/:id", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { id } = req.params;
        const statusObject = await this.shortCreator.status(id);
        res.status(200).json(statusObject);
      } catch (error) {
        logger.error({ error }, "Error fetching video status");
        res.status(500).json({
          error: "Failed to fetch video status",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.get("/logs/:id", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        
        // Aqui você pode implementar um sistema de logs em tempo real
        // Por enquanto, vamos retornar logs básicos do sistema
        const logs = [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Video ${id} processing started`,
            videoId: id
          }
        ];
        
        res.status(200).json({
          logs: logs.slice(-Number(limit)),
          total: logs.length
        });
      } catch (error) {
        logger.error({ error }, "Error fetching video logs");
        res.status(500).json({
          error: "Failed to fetch video logs",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.post("/render", async (req: ExpressRequest, res: ExpressResponse) => {
      const renderRequest = req.body as RenderRequest;
      try {
        let videoId: string;
        if (renderRequest.id) {
          // Re-renderiza um vídeo existente
          videoId = renderRequest.id;
          await this.shortCreator.reRenderVideo(
            videoId,
            renderRequest.scenes,
            renderRequest.config
          );
        } else {
          // Cria um novo vídeo
          videoId = await this.shortCreator.addToQueue(
            renderRequest.scenes,
            renderRequest.config
          );
        }
        res.status(202).json({
          message: "Video rendering started",
          videoId,
        });
      } catch (error) {
        logger.error({ error }, "Error creating short");
        res.status(500).json({
          error: "Failed to start video rendering",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Alias para /api/short-video (mantém compatibilidade)
    this.router.post("/short-video", async (req: ExpressRequest, res: ExpressResponse) => {
      const renderRequest = req.body as RenderRequest;
      try {
        let videoId: string;
        if (renderRequest.id) {
          // Re-renderiza um vídeo existente
          videoId = renderRequest.id;
          await this.shortCreator.reRenderVideo(
            videoId,
            renderRequest.scenes,
            renderRequest.config
          );
        } else {
          // Cria um novo vídeo
          videoId = await this.shortCreator.addToQueue(
            renderRequest.scenes,
            renderRequest.config
          );
        }
        res.status(202).json({
          message: "Video rendering started",
          videoId,
        });
      } catch (error) {
        logger.error({ error }, "Error creating short");
        res.status(500).json({
          error: "Failed to start video rendering",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Endpoint para status do vídeo (/api/short-video/:id/status)
    this.router.get("/short-video/:id/status", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { id } = req.params;
        const statusObject = await this.shortCreator.status(id);
        res.status(200).json(statusObject);
      } catch (error) {
        logger.error({ error }, "Error fetching video status");
        res.status(500).json({
          error: "Failed to fetch video status",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Endpoint para download do vídeo (/api/short-video/:id)
    this.router.get("/short-video/:id", (req, res) => {
      const { id } = req.params;
      const videoPath = this.shortCreator.getVideoPath(id);

      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video not found" });
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    });

    // Endpoint para listar vídeos (/api/short-videos)
    this.router.get("/short-videos", async (_req, res) => {
      try {
        const videos = await this.shortCreator.getAllVideos();
        res.json({ videos });
      } catch (error) {
        logger.error({ error }, "Error fetching videos");
        res.status(500).json({
          error: "Failed to fetch videos",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Endpoint para deletar vídeo (/api/short-video/:id)
    this.router.delete("/short-video/:id", (req, res) => {
      const { id } = req.params;
      try {
        this.shortCreator.deleteVideo(id);
        res.status(200).json({ success: true });
      } catch (error) {
        logger.error({ error, id }, "Error deleting video");
        res.status(500).json({
          error: "Failed to delete video",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.post(
      "/remotion-webhook",
      async (req: ExpressRequest, res: ExpressResponse) => {
        console.log("Received remotion webhook", req.body);
        res.status(200).json({ message: "Webhook received" });
      },
    );

    this.router.get("/videos", async (_req, res) => {
      try {
        const videos = await this.shortCreator.getAllVideos();
        res.json(videos);
      } catch (error) {
        logger.error({ error }, "Error fetching videos");
        res.status(500).json({
          error: "Failed to fetch videos",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.post(
      "/generate-tts",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { text, videoId, sceneId, referenceAudioPath, language, voice, forceRegenerate } = req.body;
          if (!text || !videoId || !sceneId) {
            return res.status(400).json({ error: "text, videoId, and sceneId are required" });
          }
          
          // A configuração da voz é passada para o método, então criamos um objeto config parcial.
          const config: Partial<RenderConfig> = { voice, language, referenceAudioPath };

          const result = await this.shortCreator.generateSingleTTSAndUpdate(videoId, sceneId, text, config as RenderConfig, forceRegenerate || false);
          res.status(200).json(result);
        } catch (error) {
          logger.error({ error }, "Error generating TTS");
          res.status(500).json({
            error: "Failed to generate TTS",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
    );

    this.router.get("/video/:id", (req, res) => {
      const { id } = req.params;
      const videoPath = this.shortCreator.getVideoPath(id);

      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video not found" });
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    });

    this.router.get("/tmp/:filename", (req, res) => {
      const { filename } = req.params;
      const audioPath = path.join(this.config.tempDirPath, filename);

      if (!fs.existsSync(audioPath)) {
        logger.error({ audioPath }, "Audio file not found");
        return res.status(404).json({ error: "Audio file not found" });
      }

      const stat = fs.statSync(audioPath);
      const fileSize = stat.size;

      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav',
      };
      res.writeHead(200, head);
      fs.createReadStream(audioPath).pipe(res);
    });

    this.router.get("/temp/:filename", (req, res) => {
      const { filename } = req.params;
      const audioPath = path.join(this.config.tempDirPath, filename);

      if (!fs.existsSync(audioPath)) {
        logger.error({ audioPath }, "Audio file not found");
        return res.status(404).json({ error: "Audio file not found" });
      }

      const stat = fs.statSync(audioPath);
      const fileSize = stat.size;

      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav',
      };
      res.writeHead(200, head);
      fs.createReadStream(audioPath).pipe(res);
    });

    this.router.post("/video-data/:id", (req, res) => {
      const { id } = req.params;
      const videoData = req.body;
      try {
        this.shortCreator.saveVideoData(id, videoData);
        res.status(200).json({ message: "Video data saved successfully" });
      } catch (error) {
        logger.error({ error, id }, "Error saving video data");
        res.status(500).json({
          error: "Failed to save video data",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.get("/video-data/:id", (req, res) => {
      const { id } = req.params;
      const video = this.shortCreator.getVideoById(id);
      if (video) {
        res.status(200).json(video);
      } else {
        res.status(404).json({ error: "Video data not found" });
      }
    });

    this.router.get("/script/:id", (req, res) => {
      const { id } = req.params;
      try {
        const script = this.shortCreator.getScriptById(id);
        if (script) {
          res.status(200).json(script);
        } else {
          res.status(404).json({ error: "Script not found" });
        }
      } catch (error) {
        logger.error({ error, id }, "Error getting script");
        res.status(500).json({
          error: "Failed to get script",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.delete("/videos/:id", (req, res) => {
      const { id } = req.params;
      try {
        this.shortCreator.deleteVideo(id);
        res.status(200).json({ message: "Video deleted successfully" });
      } catch (error) {
        logger.error({ error, id }, "Error deleting video");
        res.status(500).json({
          error: "Failed to delete video",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.delete("/videos", (req, res) => {
      try {
        this.shortCreator.clearAllVideos();
        res.status(200).json({ message: "All videos deleted successfully" });
      } catch (error) {
        logger.error({ error }, "Error clearing all videos");
        res.status(500).json({
          error: "Failed to clear all videos",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });

    this.router.get("/search-videos", async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const query = req.query.query as string;
        if (!query) {
          return res.status(400).json({ error: "Query parameter is required" });
        }
        const videos = await this.shortCreator.searchVideos(query);
        res.status(200).json({ videos });
      } catch (error) {
        logger.error({ error }, "Error searching videos");
        res.status(500).json({
          error: "Failed to search videos",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.router.use('/music', express.static(path.join(process.cwd(), 'static/music')));
    this.router.use('/overlays', express.static(path.join(process.cwd(), 'static/overlays')));
    this.router.use('/fonts', express.static(path.join(process.cwd(), 'fonts')));

    const proxyOptions: Options = {
      target: this.config.remotion.rendering.serveUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/proxy': ''
      }
    };
    this.router.use("/proxy", createProxyMiddleware(proxyOptions));
  }
}
