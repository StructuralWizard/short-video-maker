import path from "path";
import { ShortCreator } from "../src/short-creator/ShortCreator";
import { Remotion } from "../src/short-creator/libraries/Remotion";
import { FFMpeg } from "../src/short-creator/libraries/FFmpeg";
import { Config } from "../src/config";
import { MusicManager } from "../src/short-creator/music";
import { LocalTTS } from "../src/short-creator/libraries/LocalTTS";
import { VideoProcessor } from "../src/short-creator/libraries/VideoProcessor";
import { LocalImageAPI } from "../src/short-creator/libraries/LocalImageAPI";
import { logger } from "../src/logger";
import { VideoStatusManager } from "../src/short-creator/VideoStatusManager";

async function render() {
  const videoId = process.argv[2];
  if (!videoId) {
    logger.error("Render worker: No videoId provided. Exiting.");
    process.exit(1);
  }

  logger.info({ videoId }, "Render worker started for videoId.");

  try {
    logger.info("Initializing Config...");
    const config = new Config();
    
    logger.info("Initializing Remotion...");
    const remotion = await Remotion.init(config);
    
    logger.info("Initializing FFMpeg...");
    const ffmpeg = await FFMpeg.init();
    
    logger.info("Initializing LocalImageAPI...");
    const localImageApi = new LocalImageAPI();
    
    logger.info("Initializing MusicManager...");
    const musicManager = new MusicManager(config);
    
    logger.info("Initializing LocalTTS...");
    const localTTS = await LocalTTS.init(config);
    
    logger.info("Initializing VideoProcessor...");
    const videoProcessor = new VideoProcessor(config.videosDirPath);

    logger.info("Initializing VideoStatusManager...");
    const statusManager = new VideoStatusManager(config);

    logger.info("Creating ShortCreator instance...");
    const shortCreator = new ShortCreator(
      config,
      remotion,
      ffmpeg,
      localImageApi,
      musicManager,
      localTTS,
      statusManager,
      undefined,
      undefined,
      videoProcessor,
      config.concurrency
    );

    logger.info({ videoId }, "Calling renderVideoFromData...");
    // Chama um método dedicado para renderizar usando o JSON existente
    await shortCreator.renderVideoFromData(videoId);

    logger.info({ videoId }, "Render worker finished successfully.");
    process.exit(0);
  } catch (error) {
    logger.error({ videoId, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, "Render worker failed.");
    process.exit(1);
  }
}

render(); 