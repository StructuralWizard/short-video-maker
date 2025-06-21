import z from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { ensureBrowser } from "@remotion/renderer";
import fs from "fs-extra";
import https from "https";
import { URL } from "url";
import http from "http";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

import { Config } from "../../config";
import { shortVideoSchema, getOrientationConfig } from "../../shared/utils";
import { logger } from "../../logger";
import { OrientationEnum, ShortVideoData } from "../../types/shorts";

// Configura o Node.js para usar mais memória
process.env.NODE_OPTIONS = '--max-old-space-size=16384'; // 16GB para Node.js

export class Remotion {
  constructor(
    private bundled: string,
    private config: Config,
  ) {}

  private async downloadVideo(url: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      // Parse the URL properly to handle query parameters
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || '80',
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'video/*'
        }
      };

      http.get(options, (response) => {
        if (response.statusCode !== 200) {
          fs.unlink(outputPath, () => {});
          reject(new Error(`Failed to download video: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(outputPath);
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(new Error(`Failed to download video: ${err.message}`));
      });
    });
  }

  private async preDownloadVideos(scenes: any[]): Promise<string[]> {
    const downloadedVideos: string[] = [];
    for (const scene of scenes) {
      for (const videoUrl of scene.videos) {
        const url = new URL(videoUrl);
        const filename = path.basename(url.pathname);
        const outputPath = path.join(this.config.tempDirPath, filename);
        
        if (!fs.existsSync(outputPath)) {
          logger.debug(`Downloading video: ${videoUrl}`);
          await this.downloadVideo(videoUrl, outputPath);
        }
        downloadedVideos.push(outputPath);
      }
    }
    return downloadedVideos;
  }

  static async init(config: Config): Promise<Remotion> {
    await ensureBrowser();

    const entryPoint = path.join(
      process.cwd(),
      config.devMode ? "src" : "dist",
      "components",
      "root",
      "index.ts"
    );

    logger.debug({ entryPoint }, "Bundling Remotion entry point");

    const bundled = await bundle({
      entryPoint,
    });

    return new Remotion(bundled, config);
  }

  public async getMediaDuration(filePath: string): Promise<number> {
    try {
      // Check if file exists and is not empty
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(`File is empty: ${filePath}`);
      }
      
      const durationInSeconds = await getAudioDurationInSeconds(filePath);
      
      // Validate duration
      if (!durationInSeconds || isNaN(durationInSeconds) || durationInSeconds <= 0) {
        throw new Error(`Invalid duration returned: ${durationInSeconds}`);
      }
      
      return durationInSeconds;
    } catch (err: any) {
      logger.error({ filePath, error: err }, "Failed to get media duration.");
      throw new Error(`Could not get duration for ${filePath}: ${err.message || 'Unknown error'}`);
    }
  }

  public async renderMedia(
    id: string,
    data: ShortVideoData,
    onProgress: (progress: number) => void,
    orientation: OrientationEnum = OrientationEnum.portrait
  ) {
    const { component } = getOrientationConfig(orientation);

    logger.info({ videoID: id, component }, "Starting Remotion render process");

    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: component,
      inputProps: data,
    });

    logger.info({ 
      videoID: id, 
      component, 
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      width: composition.width,
      height: composition.height
    }, "Composition selected for rendering");

    const outputLocation = path.join(this.config.videosDirPath, `${id}.mp4`);

    try {
      let lastProgress = 0;
      await renderMedia({
        codec: "h264",
        composition,
        serveUrl: this.bundled,
        outputLocation,
        inputProps: data,
        onProgress: ({ progress }) => {
          const progressPercent = Math.round(progress * 100);
          // Log apenas quando o progresso muda significativamente (a cada 10%)
          if (progressPercent >= lastProgress + 10 || progressPercent === 100) {
            logger.info({ 
              videoID: id, 
              progress: progressPercent,
              stage: progressPercent < 20 ? "Initializing" : 
                     progressPercent < 50 ? "Processing frames" :
                     progressPercent < 80 ? "Encoding video" : "Finalizing"
            }, `Render progress: ${progressPercent}%`);
            lastProgress = progressPercent;
          }
          // Chama onProgress com menos frequência para reduzir I/O
          if (progressPercent >= lastProgress + 5 || progressPercent === 100) {
            onProgress(progress);
          }
        },
        concurrency: 10,
        offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024 * 8, // 8GB de cache
        chromiumOptions: {
          disableWebSecurity: true,
          ignoreCertificateErrors: true
        },
        timeoutInMilliseconds: 300000 // 5 minutos para o processo todo
      });
      
      logger.info({ 
        component, 
        videoID: id,
        outputLocation,
        fileSize: fs.existsSync(outputLocation) ? fs.statSync(outputLocation).size : 0
      }, "Video rendered successfully with Remotion");
    } catch (err) {
      logger.error({ videoID: id, error: err }, "Remotion render failed");
      throw err;
    }
  }

  async render(
    data: z.infer<typeof shortVideoSchema>,
    id: string,
    orientation: OrientationEnum,
  ) {
    const { component } = getOrientationConfig(orientation);

    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: component,
      inputProps: data,
    });

    logger.debug({ component, videoID: id }, "Rendering video with Remotion");

    const outputLocation = path.join(this.config.videosDirPath, `${id}.mp4`);

    try {
      await renderMedia({
        codec: "h264",
        composition,
        serveUrl: this.bundled,
        outputLocation,
        inputProps: data,
        onProgress: ({ progress }) => {
          logger.debug(`Rendering ${id} ${Math.floor(progress * 100)}% complete`);
        },
        concurrency: 10,
        offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024 * 8, // 8GB de cache
        chromiumOptions: {
          disableWebSecurity: true,
          ignoreCertificateErrors: true
        },
        timeoutInMilliseconds: 300000 // 5 minutos para o processo todo
      });
      
      logger.debug(
        {
          component,
          videoID: id,
        },
        "Video rendered with Remotion",
      );

    } catch (err) {
      logger.error("Remotion render failed");
      throw err;
    }
  }

  async testRender(outputLocation: string) {
    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: "TestVideo",
    });

    await renderMedia({
      codec: "h264",
      composition,
      serveUrl: this.bundled,
      outputLocation,
      onProgress: ({ progress }) => {
        logger.debug(
          `Rendering test video: ${Math.floor(progress * 100)}% complete`,
        );
      },
      concurrency: 1, // Forçar processamento sequencial
      offthreadVideoCacheSizeInBytes: this.config.videoCacheSizeInBytes,
    });
  }
}
