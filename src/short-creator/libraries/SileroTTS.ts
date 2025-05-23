import { Config } from "../../config";
import { logger } from "../../logger";
import path from "path";
import fs from "fs-extra";
import axios from "axios";
import FormData from "form-data";

export class SileroTTS {
  private readonly ttsServerUrl: string;

  constructor(private config: Config) {
    this.ttsServerUrl = "http://localhost:5001/tts";
  }

  static async init(config: Config): Promise<SileroTTS> {
    return new SileroTTS(config);
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    emotion: string = "emotional",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<void> {
    logger.info({ 
      text, 
      outputPath, 
      emotion, 
      language, 
      referenceAudioPath,
      cwd: process.cwd()
    }, "🚀 Iniciando geração de áudio com TTS");

    try {
      const refPath = referenceAudioPath;
      logger.info({ 
        refPath,
        exists: fs.existsSync(refPath || 'NinoSample.wav'),
        absolutePath: path.resolve(refPath || 'NinoSample.wav')
      }, "📂 Verificando arquivo de referência");

      if (!refPath) {
        logger.warn("⚠️ No referenceAudioPath provided, using default NinoSample.wav");
      }

      const formData = new FormData();
      formData.append("text", text);
      formData.append("reference_audio", path.basename(refPath || "NinoSample.wav"));
      formData.append("language", language);
      formData.append("emotion", emotion);

      logger.info({ formData }, "📤 Sending request to TTS server");

      const response = await axios.post(this.ttsServerUrl, formData, {
        responseType: "arraybuffer",
        headers: {
          ...formData.getHeaders(),
        },
      });

      await fs.writeFile(outputPath, Buffer.from(response.data));
      
      logger.info({ outputPath }, "🎵 Speech generated successfully");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data ? 
          Buffer.from(error.response.data).toString() : 
          'No error data';
        
        logger.error({ 
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorData,
          text,
          outputPath,
          emotion,
          language,
          referenceAudioPath,
          cwd: process.cwd()
        }, "❌ Failed to generate speech");
      } else {
        logger.error({ 
          error,
          text,
          outputPath,
          emotion,
          language,
          referenceAudioPath,
          cwd: process.cwd()
        }, "❌ Failed to generate speech");
      }
      throw error;
    }
  }
} 