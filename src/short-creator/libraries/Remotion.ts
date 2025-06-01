import z from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { ensureBrowser } from "@remotion/renderer";
import fs from "fs-extra";
import https from "https";
import { URL } from "url";

import { Config } from "../../config";
import { shortVideoSchema, getOrientationConfig } from "../../shared/utils";
import { logger } from "../../logger";
import { OrientationEnum } from "../../types/shorts";

export class Remotion {
  constructor(
    private bundled: string,
    private config: Config,
  ) {}

  private async downloadVideo(url: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(outputPath);
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
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
        concurrency: 8,
        offthreadVideoCacheSizeInBytes: this.config.videoCacheSizeInBytes,
        chromiumOptions: {
          disableWebSecurity: true,
          ignoreCertificateErrors: true
        },
        timeoutInMilliseconds: 300000 // 5 minutos para o processo todo
      });
      
      logger.debug(
        {
          outputLocation,
          component,
          videoID: id,
        },
        "Video rendered with Remotion",
      );
    } catch (err) {
      logger.error("Remotion render failed", err);
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
