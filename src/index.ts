/* eslint-disable @typescript-eslint/no-unused-vars */
import path from "path";
import fs from "fs-extra";

import { Remotion } from "./short-creator/libraries/Remotion";
import { FFMpeg } from "./short-creator/libraries/FFmpeg";
import { PexelsAPI } from "./short-creator/libraries/Pexels";
import { Config } from "./config";
import { ShortCreator } from "./short-creator/ShortCreator";
import { logger } from "./utils/logger";
import { Server } from "./server/server";
import { MusicManager } from "./short-creator/music";
import { SileroTTS } from "./short-creator/libraries/SileroTTS";
import { VideoProcessor } from "./short-creator/libraries/VideoProcessor";
import { PixabayAPI } from "./short-creator/libraries/Pixabay";

async function main() {
  try {
    // Carregar configuração
    const config = new Config();

    // Inicializar componentes
    const remotion = await Remotion.init(config);
    const ffmpeg = await FFMpeg.init();
    const pexelsApi = new PexelsAPI(config.pexelsApiKey);
    const pixabayApi = new PixabayAPI(config.pixabayApiKey);
    const musicManager = new MusicManager(config);
    const sileroTTS = await SileroTTS.init(config);
    const videoProcessor = new VideoProcessor(config.videosDirPath);

    const shortCreator = new ShortCreator(
      config,
      remotion,
      ffmpeg,
      pexelsApi,
      musicManager,
      sileroTTS,
      config.pixabayApiKey,
      config.pexelsApiKey,
      videoProcessor,
      config.concurrency
    );

    // Iniciar servidor
    const server = new Server(config, shortCreator);
    await server.start();
  } catch (error) {
    logger.error("Error in main:", error);
    process.exit(1);
  }
}

main();
