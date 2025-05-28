import z from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { ensureBrowser } from "@remotion/renderer";

import { Config } from "../../config";
import { shortVideoSchema, getOrientationConfig } from "../../shared/utils";
import { logger } from "../../logger";
import { OrientationEnum } from "../../types/shorts";

export class Remotion {
  constructor(
    private bundled: string,
    private config: Config,
  ) {}

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

    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
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
          concurrency: this.config.concurrency,
          offthreadVideoCacheSizeInBytes: this.config.videoCacheSizeInBytes,
        });
        logger.debug(
          {
            outputLocation,
            component,
            videoID: id,
          },
          "Video rendered with Remotion",
        );
        break; // sucesso
      } catch (err) {
        attempt++;
        logger.error(`Remotion render failed, attempt ${attempt} of ${maxAttempts}`, err);
        if (attempt >= maxAttempts) throw err;
        await new Promise(res => setTimeout(res, 5000)); // espera 5s antes de tentar de novo
      }
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
      // preventing memory issues with docker
      concurrency: this.config.concurrency,
      offthreadVideoCacheSizeInBytes: this.config.videoCacheSizeInBytes,
    });
  }
}
