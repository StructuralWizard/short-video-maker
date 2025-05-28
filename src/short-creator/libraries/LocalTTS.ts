import { Config } from "../../config";
import { logger } from "../../utils/logger";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import FormData from "form-data";

export class LocalTTS {
  private readonly serviceUrl: string;
  private outputDir: string;

  constructor(private config: Config, outputDir: string = "output/audio") {
    this.serviceUrl = "http://localhost:5001";
    this.outputDir = outputDir;
  }

  static async init(config: Config): Promise<LocalTTS> {
    const tts = new LocalTTS(config);
    // Verifica se o serviço está rodando
    try {
      const response = await axios.get(`${tts.serviceUrl}/health`);
      if (response.data.status !== "ok") {
        throw new Error("TTS service is not healthy");
      }
      logger.info("TTS service is running and healthy");
    } catch (error) {
      logger.error("Failed to connect to TTS service", { error });
      throw new Error("TTS service is not available");
    }
    return tts;
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    emotion: string = "neutral",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<void> {
    logger.info("🚀 Iniciando geração de áudio com TTS local", {
      text,
      outputPath,
      emotion,
      language,
      referenceAudioPath,
    });

    try {
      const refPath = referenceAudioPath || this.config.referenceAudioPath;
      
      logger.info("📂 Usando arquivo de referência", {
        refPath,
        absolutePath: path.resolve(refPath)
      });

      // Cria o diretório de saída se não existir
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Prepara a requisição
      const formData = new FormData();
      formData.append("text", text);
      formData.append("reference_audio", path.basename(refPath));
      formData.append("language", language);
      formData.append("emotion", emotion);

      // Faz a requisição para o serviço TTS
      const response = await axios.post(`${this.serviceUrl}/tts`, formData, {
        responseType: "arraybuffer",
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Salva o arquivo de áudio
      await fs.writeFile(outputPath, response.data);
      
      logger.info("🎵 Speech generated successfully", { outputPath });
    } catch (error) {
      logger.error("❌ Failed to generate speech", {
        error,
        text,
        outputPath,
        emotion,
        language,
        referenceAudioPath,
      });
      throw error;
    }
  }
} 