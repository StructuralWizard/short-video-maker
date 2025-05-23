import { Config } from "../../config";
import { logger } from "../../utils/logger";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import FormData from "form-data";

export class SileroTTS {
  private readonly ttsServerUrl: string;
  private outputDir: string;

  constructor(private config: Config, outputDir: string = "output/audio") {
    this.ttsServerUrl = "http://localhost:5001/tts";
    this.outputDir = outputDir;
  }

  static async init(config: Config): Promise<SileroTTS> {
    return new SileroTTS(config);
  }

  async generateAudio(text: string): Promise<string> {
    try {
      const outputPath = path.join(this.outputDir, `${Date.now()}.wav`);
      await fs.mkdir(this.outputDir, { recursive: true });

      const formData = new FormData();
      formData.append("text", text);
      formData.append("output_path", outputPath);

      const response = await axios.post(this.ttsServerUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        responseType: "arraybuffer",
      });

      if (response.status !== 200) {
        throw new Error(`TTS server returned status ${response.status}`);
      }

      await fs.writeFile(outputPath, response.data);
      return outputPath;
    } catch (error) {
      logger.error("Error generating audio:", error);
      throw error;
    }
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    emotion: string = "emotional",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<void> {
    logger.info("🚀 Iniciando geração de áudio com TTS", {
      text,
      outputPath,
      emotion,
      language,
      referenceAudioPath,
      cwd: process.cwd()
    });

    try {
      const refPath = referenceAudioPath || "NinoSample.wav";
      
      logger.info("📂 Usando arquivo de referência", {
        refPath,
        absolutePath: path.resolve(refPath)
      });

      const formData = new FormData();
      formData.append("text", text);
      formData.append("reference_audio", path.basename(refPath));
      formData.append("language", language);
      formData.append("emotion", emotion);

      logger.info("📤 Sending request to TTS server", { formData });

      const response = await axios.post(this.ttsServerUrl, formData, {
        responseType: "arraybuffer",
        headers: {
          ...formData.getHeaders(),
        },
      });

      await fs.writeFile(outputPath, Buffer.from(response.data));
      
      logger.info("🎵 Speech generated successfully", { outputPath });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data ? 
          Buffer.from(error.response.data).toString() : 
          'No error data';
        
        logger.error("❌ Failed to generate speech", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorData,
          text,
          outputPath,
          emotion,
          language,
          referenceAudioPath,
          cwd: process.cwd()
        });
      } else {
        logger.error("❌ Failed to generate speech", {
          error,
          text,
          outputPath,
          emotion,
          language,
          referenceAudioPath,
          cwd: process.cwd()
        });
      }
      throw error;
    }
  }

  async getWordTimings(text: string, language: string = "pt"): Promise<{ start: number; end: number }[]> {
    const words = text.split(" ");
    const wordCount = words.length;
    
    // Calcula a duração média por palavra baseado no tamanho do texto
    // Palavras mais longas tendem a levar mais tempo para falar
    const averageWordLength = words.reduce((acc, word) => acc + word.length, 0) / wordCount;
    const baseDuration = 150; // 150ms por caractere como base (reduzido de 200ms)
    const totalDuration = averageWordLength * baseDuration * wordCount;
    
    // Ajusta a duração de cada palavra baseado no seu tamanho e posição
    return words.map((word, i) => {
      // Palavras no início e fim tendem a ser faladas mais devagar
      const positionFactor = i === 0 || i === wordCount - 1 ? 1.2 : 1;
      
      // Palavras com pontuação tendem a ter uma pausa
      const punctuationFactor = /[.,!?]$/.test(word) ? 1.3 : 1;
      
      // Palavras em maiúsculas tendem a ser enfatizadas
      const emphasisFactor = word === word.toUpperCase() ? 1.2 : 1;
      
      const wordDuration = (word.length * baseDuration * positionFactor * punctuationFactor * emphasisFactor);
      const start = i === 0 ? 0 : words.slice(0, i).reduce((acc, w, idx) => {
        const wLength = w.length;
        const wPosFactor = idx === 0 || idx === wordCount - 1 ? 1.2 : 1;
        const wPunctFactor = /[.,!?]$/.test(w) ? 1.3 : 1;
        const wEmphasisFactor = w === w.toUpperCase() ? 1.2 : 1;
        return acc + (wLength * baseDuration * wPosFactor * wPunctFactor * wEmphasisFactor);
      }, 0);
      
      return {
        start,
        end: start + wordDuration
      };
    });
  }
} 