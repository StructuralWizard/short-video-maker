import { Config } from "../../config";
import { logger } from "../../logger";
import path from "path";
import fs from "fs/promises";
import axios, { AxiosError } from "axios";
// @ts-ignore
import fetch from "node-fetch";
import { FFMpeg } from "./FFmpeg";
import FormData from "form-data";
import { cleanSceneText, splitTextByPunctuation } from "../utils/textCleaner";
import ffmpeg from "fluent-ffmpeg";

export class LocalTTS {
  private readonly serviceUrl: string;
  private outputDir: string;
  private ffmpeg: FFMpeg;

  constructor(private config: Config, ffmpeg: FFMpeg, outputDir: string = "output/audio") {
    this.serviceUrl = "http://localhost:5003";
    this.outputDir = outputDir;
    this.ffmpeg = ffmpeg;
  }

  static async init(config: Config): Promise<LocalTTS> {
    const ffmpeg = await FFMpeg.init();
    return new LocalTTS(config, ffmpeg);
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    emotion: string = "neutral",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<{ audioPath: string, subtitles: any[], duration: number }> {
    logger.info("🚀 Iniciando geração de áudio com TTS", {
      text,
      outputPath,
      emotion,
      language,
      referenceAudioPath,
    });

    try {
      // 1. Limpar o texto
      const cleanedText = cleanSceneText(text);
      
      // 2. Dividir em frases
      const sentences = splitTextByPunctuation(cleanedText);
      
      logger.info("📝 Texto processado", {
        original: text,
        cleaned: cleanedText,
        sentences: sentences
      });

      if (sentences.length === 0) {
        throw new Error("No valid sentences found after text processing");
      }

      // 3. Gerar áudio para cada frase
      const audioChunks: string[] = [];
      const allSubtitles: any[] = [];
      let totalDuration = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        // Remover pontuação final para o TTS
        const sentenceForTTS = sentence.replace(/[.,!?;]+$/, '').trim();
        
        if (sentenceForTTS.length === 0) continue;

        logger.info(`🎵 Gerando áudio para frase ${i + 1}/${sentences.length}: "${sentenceForTTS}"`);

        // Gerar áudio para esta frase
        const chunkAudioPath = await this.generateSingleChunk(
          sentenceForTTS,
          referenceAudioPath,
          language,
          i
        );

        // Obter duração do chunk
        const chunkDuration = await this.ffmpeg.getAudioDuration(chunkAudioPath);
        
        // Adicionar ao array de chunks
        audioChunks.push(chunkAudioPath);
        
        // Criar legendas para esta frase
        const words = sentenceForTTS.split(/\s+/);
        const wordCount = words.length;
        const durationPerWord = wordCount > 0 ? (chunkDuration * 1000) / wordCount : 0;

        const chunkSubtitles = words.map((word, index) => {
          const start = totalDuration * 1000 + (index * durationPerWord);
          const end = start + durationPerWord;
          return { text: word, start, end };
        });

        allSubtitles.push(...chunkSubtitles);
        totalDuration += chunkDuration;

        // Adicionar 1 segundo de silêncio entre chunks (exceto no último)
        if (i < sentences.length - 1) {
          totalDuration += 1;
        }
      }

      // 4. Juntar todos os chunks com silêncio entre eles
      await this.joinAudioChunks(audioChunks, outputPath, sentences.length);

      // 5. Limpar arquivos temporários
      for (const chunkPath of audioChunks) {
        try {
          await fs.unlink(chunkPath);
        } catch (e) {
          logger.warn("Failed to delete temporary chunk", { chunkPath, error: e });
        }
      }

      logger.info("🎵 Speech generated successfully", { 
        outputPath, 
        totalDuration,
        chunks: audioChunks.length,
        sentences: sentences.length
      });

      return {
        audioPath: outputPath,
        subtitles: allSubtitles,
        duration: totalDuration,
      };
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

  private async generateSingleChunk(
    text: string,
    referenceAudioPath?: string,
    language: string = "pt",
    chunkIndex: number = 0
  ): Promise<string> {
    const refPath = referenceAudioPath || this.config.referenceAudioPath;
    const refFileName = path.basename(refPath);
    
    // Criar nome único para o chunk
    const chunkId = `chunk_${chunkIndex}_${Date.now()}`;
    const chunkPath = path.join(this.config.tempDirPath, `${chunkId}.wav`);

    // Cria o diretório de saída se não existir
    await fs.mkdir(path.dirname(chunkPath), { recursive: true });

    // Prepara a requisição como JSON
    const requestData = {
      text: text,
      language,
      reference_audio_filename: refFileName,
    };

    logger.debug("TTS request data", {
      text,
      language,
      refPath,
      refFileName,
      requestData
    });

    // Faz a requisição para o serviço TTS
    const response = await fetch(`${this.serviceUrl}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS server returned status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();

    if (!responseData || !responseData.download_link) {
      logger.error("Invalid response from TTS server", { responseData });
      throw new Error("Invalid response from TTS server: missing download link");
    }

    // Faz o download do arquivo de áudio
    const downloadUrl = `${this.serviceUrl}${responseData.download_link}`;
    logger.debug("📥 Downloading chunk audio", { 
      downloadUrl,
      chunkIndex,
      text,
      responseData
    });

    const downloadResponse = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Salva o arquivo de áudio
    await fs.writeFile(chunkPath, downloadResponse.data);
    
    return chunkPath;
  }

  private async joinAudioChunks(
    chunkPaths: string[],
    outputPath: string,
    totalChunks: number
  ): Promise<void> {
    if (chunkPaths.length === 0) {
      throw new Error("No audio chunks to join");
    }

    if (chunkPaths.length === 1) {
      // Se só tem um chunk, apenas copia
      await fs.copyFile(chunkPaths[0], outputPath);
      return;
    }

    // Criar arquivo de silêncio de 1 segundo
    const silencePath = await this.createSilenceFile();

    try {
      // Criar arquivo de lista para o FFmpeg com silêncio entre chunks
      const listPath = path.join(this.config.tempDirPath, `concat_${Date.now()}.txt`);
      const listContent = chunkPaths.map(chunkPath => `file '${chunkPath}'`).join('\n');
      
      // Adicionar silêncio entre chunks (exceto após o último)
      const listWithSilence = chunkPaths.map((chunkPath, index) => {
        if (index === chunkPaths.length - 1) {
          return `file '${chunkPath}'`;
        } else {
          return `file '${chunkPath}'\nfile '${silencePath}'`;
        }
      }).join('\n');
      
      await fs.writeFile(listPath, listWithSilence);

      // Usar FFmpeg para concatenar os chunks com silêncio
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .audioCodec('copy')
          .output(outputPath)
          .on('end', () => {
            logger.debug("Audio chunks joined with silence successfully", { 
              chunks: chunkPaths.length,
              outputPath 
            });
            resolve();
          })
          .on('error', (err: any) => {
            logger.error("Error joining audio chunks", { error: err });
            reject(err);
          })
          .run();
      });
    } finally {
      // Limpar arquivos temporários
      try {
        const listPath = path.join(this.config.tempDirPath, `concat_${Date.now()}.txt`);
        await fs.unlink(listPath);
      } catch (e) {
        logger.warn("Failed to delete concat list file", { error: e });
      }
      
      try {
        await fs.unlink(silencePath);
      } catch (e) {
        logger.warn("Failed to delete silence file", { silencePath, error: e });
      }
    }
  }

  private async createSilenceFile(): Promise<string> {
    const silencePath = path.join(this.config.tempDirPath, `silence_1s_${Date.now()}.wav`);
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input('anullsrc')
        .inputOptions(['-f', 'lavfi'])
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(24000)
        .duration(1)
        .output(silencePath)
        .on('end', () => {
          logger.debug("Silence file created", { silencePath });
          resolve();
        })
        .on('error', (err: any) => {
          logger.error("Error creating silence file", { error: err });
          reject(err);
        })
        .run();
    });

    return silencePath;
  }
} 