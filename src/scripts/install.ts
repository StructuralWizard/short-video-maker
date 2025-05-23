import { Config } from "../config";
import { logger } from "../logger";
import { FFMpeg } from "../short-creator/libraries/FFmpeg";
import { Remotion } from "../short-creator/libraries/Remotion";
import { PexelsAPI } from "../short-creator/libraries/Pexels";
import { SileroTTS } from "../short-creator/libraries/SileroTTS";

async function main() {
  const config = new Config();
  try {
    config.ensureConfig();
  } catch (err: unknown) {
    logger.error(err, "Error in config");
    process.exit(1);
  }

  logger.info("Installing FFmpeg...");
  await FFMpeg.init();

  logger.info("Installing Remotion...");
  await Remotion.init(config);

  logger.info("Installing SileroTTS...");
  await SileroTTS.init(config);

  logger.info("Testing Pexels API...");
  const pexelsApi = new PexelsAPI(config.pexelsApiKey);
  await pexelsApi.findVideo(["dog"], 2.4);

  logger.info("Installation completed successfully!");
}

main().catch((error: unknown) => {
  logger.error(error, "Error during installation");
  process.exit(1);
});
