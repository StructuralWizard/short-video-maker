import { Config } from "../../config";
import { logger } from "../../logger";
import path from "path";
import fs from "fs-extra";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

export class SileroTTS {
  private modelPath: string;
  private device: string;
  private referenceAudioPath: string;
  private scriptPath: string;

  constructor(private config: Config) {
    this.modelPath = path.join(config.dataDirPath, "models", "silero_tts");
    this.device = "cpu"; // or "cuda" if you have NVIDIA GPU
    this.referenceAudioPath = config.referenceAudioPath || path.join(process.cwd(), "NinoSample.wav");
    this.scriptPath = path.join(__dirname, "generate_speech.py");
  }

  static async init(config: Config): Promise<SileroTTS> {
    const tts = new SileroTTS(config);
    await tts.ensureModel();
    return tts;
  }

  private async ensureModel() {
    if (!fs.existsSync(this.modelPath)) {
      logger.debug("Downloading Silero TTS model");
      fs.ensureDirSync(this.modelPath);
    }

    // Verify reference audio exists
    if (!fs.existsSync(this.referenceAudioPath)) {
      throw new Error(`Reference audio file not found at ${this.referenceAudioPath}`);
    }

    // Verify Python script exists
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(`Python script not found at ${this.scriptPath}`);
    }
  }

  async generateSpeech(text: string, outputPath: string): Promise<void> {
    logger.debug({ text, outputPath }, "Generating speech with YourTTS");

    try {
      const command = `python3 ${this.scriptPath} --text "${text}" --output "${outputPath}" --reference "${this.referenceAudioPath}" --language "${this.config.language}"`;
      await execAsync(command);
      logger.debug({ outputPath }, "Speech generated successfully");
    } catch (error) {
      logger.error({ error }, "Failed to generate speech");
      throw error;
    }
  }
} 