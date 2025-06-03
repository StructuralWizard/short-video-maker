/* eslint-disable @typescript-eslint/no-unused-vars */
import path from "path";
import fs from "fs-extra";

import { Remotion } from "./short-creator/libraries/Remotion";
import { FFMpeg } from "./short-creator/libraries/FFmpeg";
import { Config } from "./config";
import { ShortCreator } from "./short-creator/ShortCreator";
import { logger } from "./utils/logger";
import { Server } from "./server/server";
import { MusicManager } from "./short-creator/music";
import { LocalTTS } from "./short-creator/libraries/LocalTTS";
import { VideoProcessor } from "./short-creator/libraries/VideoProcessor";
import { LocalImageAPI } from "./short-creator/libraries/LocalImageAPI";

async function main() {
  try {
    // Carregar configuração
    const config = new Config();

    // Inicializar componentes
    const remotion = await Remotion.init(config);
    const ffmpeg = await FFMpeg.init();
    const localImageApi = new LocalImageAPI();
    const musicManager = new MusicManager(config);
    const localTTS = await LocalTTS.init(config);
    const videoProcessor = new VideoProcessor(config.videosDirPath);

    const shortCreator = new ShortCreator(
      config,
      remotion,
      ffmpeg,
      localImageApi,
      musicManager,
      localTTS,
      undefined,
      undefined,
      videoProcessor,
      config.concurrency
    );

    // Iniciar servidor
    const server = new Server(config, shortCreator);
    await server.start();
    logger.info("Server started successfully");

    // Configurar handlers para sinais do processo
    process.on('SIGINT', () => {
      logger.info('Received SIGINT. Cleaning up...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM. Cleaning up...');
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Manter o processo vivo
    setInterval(() => {
      logger.debug('Process is still alive...');
    }, 60000); // Log a cada minuto

    logger.info('Server is ready to handle requests');
  } catch (error) {
    logger.error("Error in main:", error);
    process.exit(1);
  }
}

// Iniciar o servidor
main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
