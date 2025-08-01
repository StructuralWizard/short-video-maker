import path from "path";
import { logger } from "../utils/logger";
import { Config } from "../config";
import axios, { AxiosError } from "axios";
import fs from "fs/promises";
import fetch from "node-fetch";

export interface TTSConfig {
  speakerId?: string;
  language?: string;
  referenceAudioPath?: string;
}

export class SileroTTS {
  private readonly serviceUrl: string;
  private outputDir: string;

  constructor(private config: Config, outputDir: string = "output/audio") {
    this.serviceUrl = "http://localhost:5003";  // Updated to use hybrid service port
    this.outputDir = outputDir;
  }

  static async init(config: Config): Promise<SileroTTS> {
    return new SileroTTS(config);
  }

  private async ensureFileWritten(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error("File is empty");
      }
    } catch (error) {
      throw new Error(`Failed to verify file: ${error}`);
    }
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    emotion: string = "neutral",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<void> {
    logger.info("🚀 Iniciando geração de áudio com Silero TTS", {
      text,
      outputPath,
      emotion,
      language,
      referenceAudioPath,
    });

    try {
      const refPath = referenceAudioPath || this.config.referenceAudioPath;
      const refFileName = path.basename(refPath);
      const refFileNameWithoutExt = path.parse(refFileName).name;
      
      logger.info("📂 Usando arquivo de referência", {
        refPath,
        absolutePath: path.resolve(refPath),
        refFileName,
        refFileNameWithoutExt
      });

      // Cria o diretório de saída se não existir
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Mapear referenceAudioPath para voice name
      let voiceName = "Paulo"; // default
      if (referenceAudioPath) {
        const baseName = path.basename(referenceAudioPath, path.extname(referenceAudioPath));
        voiceName = baseName; // Charlotte, Hamilton, Noel, etc.
      }

      // Prepara a requisição para o serviço híbrido
      const requestData = {
        text,
        voice: voiceName
      };

      // Log the request details
      logger.debug("Sending request to Hybrid TTS server", {
        url: `${this.serviceUrl}/generate`,
        requestData,
        voiceName
      });

      // Faz a requisição para o serviço híbrido TTS
      const response = await fetch(`${this.serviceUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hybrid TTS server returned status ${response.status}: ${errorText}`);
      }

      // O serviço híbrido retorna diretamente o arquivo de áudio
      const audioBuffer = await response.arrayBuffer();
      
      // Salva o arquivo de áudio
      await fs.writeFile(outputPath, Buffer.from(audioBuffer));
      
      // Verifica se o arquivo foi escrito corretamente
      await this.ensureFileWritten(outputPath);
      
      logger.info("🎵 Speech generated successfully", { outputPath });
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      logger.error("❌ Failed to generate speech", {
        error,
        text,
        outputPath,
        emotion,
        language,
        referenceAudioPath,
        errorMessage: axiosError.message,
        errorResponse: axiosError.response?.data,
        errorStatus: axiosError.response?.status,
        errorHeaders: axiosError.response?.headers,
        errorConfig: {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          headers: axiosError.config?.headers,
          data: axiosError.config?.data
        }
      });
      throw error;
    }
  }
} 