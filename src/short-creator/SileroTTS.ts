import path from "path";
import { logger } from "../utils/logger";
import { Config } from "../config";
import axios from "axios";
import FormData from "form-data";
import fs from "fs/promises";

export interface TTSConfig {
  speakerId?: string;
  language?: string;
  referenceAudioPath?: string;
}

export class SileroTTS {
  private globalConfig: Config;

  constructor(globalConfig: Config) {
    this.globalConfig = globalConfig;
  }

  private async ensureFileWritten(filePath: string, maxRetries = 5, delayMs = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          // Tenta abrir o arquivo para leitura para garantir que está liberado
          const fd = await fs.open(filePath, 'r');
          await fd.close();
          return;
        }
      } catch (error) {
        logger.debug("Waiting for file to be written", { error, attempt: i + 1 });
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error(`File ${filePath} was not properly written after ${maxRetries} attempts`);
  }

  public async generateSpeech(text: string, config: TTSConfig): Promise<Buffer> {
    const speakerId = config.speakerId || "en_0";
    const language = config.language || "en";
    const referenceAudioPath = config.referenceAudioPath || this.globalConfig.referenceAudioPath;
    const refPath = referenceAudioPath || "NinoSample.wav";

    logger.info("📂 Usando arquivo de referência", {
      refPath,
      absolutePath: path.resolve(refPath)
    });

    const formData = new FormData();
    formData.append("text", text);
    formData.append("speaker_id", speakerId);
    formData.append("language", language);
    formData.append("reference_audio", path.basename(refPath));

    const response = await axios.post("http://localhost:5001/tts", formData, {
      responseType: "arraybuffer",
      headers: {
        ...formData.getHeaders(),
      },
    });

    const buffer = Buffer.from(response.data);
    
    // Garante que o buffer foi completamente escrito
    await this.ensureFileWritten(refPath);
    
    return buffer;
  }
} 