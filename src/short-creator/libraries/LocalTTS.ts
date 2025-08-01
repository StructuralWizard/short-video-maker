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
    this.serviceUrl = "http://localhost:5003";  // Updated to use hybrid service port
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
    voice: string = "Paulo",
    language: string = "pt",
    referenceAudioPath?: string
  ): Promise<{ audioPath: string, subtitles: any[], duration: number }> {
    logger.info("🚀 Iniciando geração de áudio com TTS", {
      text,
      outputPath,
      voice,
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

        let chunkAudioPath: string;
        let chunkDuration: number;

        try {
          // Tentar gerar áudio para esta frase
          chunkAudioPath = await this.generateSingleChunk(
            sentenceForTTS,
            voice,
            language,
            i
          );

          // Obter duração do chunk
          chunkDuration = await this.ffmpeg.getAudioDuration(chunkAudioPath);
        } catch (error) {
          logger.warn(`Falha ao gerar TTS para frase ${i + 1}, criando áudio silencioso`, { error });
          
          // Fallback: criar áudio silencioso baseado no tamanho do texto
          const estimatedDuration = Math.max(2, sentenceForTTS.length * 0.1); // ~0.1s por caractere, mínimo 2s
          chunkAudioPath = await this.createSilenceFile(estimatedDuration, `fallback_${i}_${Date.now()}.wav`);
          chunkDuration = estimatedDuration;
        }
        
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
        sentences: sentences.length,
        subtitlesCount: allSubtitles.length
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
        voice,
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
    voice: string,
    language: string = "pt",
    chunkIndex: number = 0
  ): Promise<string> {
    logger.info("🎯 Generating TTS chunk with hybrid service", { 
      voice, 
      text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      language,
      chunkIndex,
      serviceUrl: this.serviceUrl
    });
    
    // Criar nome único para o chunk
    const chunkId = `chunk_${chunkIndex}_${Date.now()}`;
    const chunkPath = path.join(this.config.tempDirPath, `${chunkId}.wav`);

    // Cria o diretório de saída se não existir
    await fs.mkdir(path.dirname(chunkPath), { recursive: true });

    // Prepara a requisição para o híbrido service
    const requestData = {
      text: text,
      voice: voice  // Use voice name directly (Charlotte, Hamilton, Noel, etc.)
    };

    logger.info("📤 Sending request to hybrid TTS service", {
      url: `${this.serviceUrl}/generate`,
      method: 'POST',
      requestData,
      headers: { 'Content-Type': 'application/json' }
    });

    // Faz a requisição para o serviço híbrido TTS
    logger.info("🌐 Making HTTP request to hybrid TTS service...");
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout
    
    let response;
    try {
      response = await fetch(`${this.serviceUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    logger.info("📥 Received response from hybrid TTS service", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("❌ Hybrid TTS server error", {
        status: response.status,
        statusText: response.statusText,
        errorText,
        requestData
      });
      throw new Error(`Hybrid TTS server returned status ${response.status}: ${errorText}`);
    }

    // O serviço híbrido retorna diretamente o arquivo de áudio
    logger.info("📦 Reading audio buffer from response...");
    const audioBuffer = await response.arrayBuffer();
    
    if (audioBuffer.byteLength === 0) {
      logger.error("❌ Received empty audio buffer from hybrid TTS service");
      throw new Error("Received empty audio buffer from hybrid TTS service");
    }

    logger.info("💾 Saving audio file", {
      chunkPath,
      bufferSize: audioBuffer.byteLength
    });
    
    // Salva o arquivo de áudio
    await fs.writeFile(chunkPath, Buffer.from(audioBuffer));
    
    // Aguarda o arquivo estar completamente acessível
    await this.waitForFileReady(chunkPath);
    
    logger.info("✅ Chunk audio downloaded and saved from hybrid service", { 
      chunkPath,
      chunkIndex,
      text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
      fileSize: (await fs.stat(chunkPath)).size
    });

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

  private async createSilenceFile(duration: number = 1, filename?: string): Promise<string> {
    const silencePath = filename ? 
      path.join(this.config.tempDirPath, filename) : 
      path.join(this.config.tempDirPath, `silence_${duration}s_${Date.now()}.wav`);
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input('anullsrc')
        .inputOptions(['-f', 'lavfi'])
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(24000)
        .duration(duration)
        .output(silencePath)
        .on('end', () => {
          logger.debug("Silence file created", { silencePath, duration });
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

  private async waitForFileReady(filePath: string): Promise<void> {
    const maxWaitTime = 10000; // 10 segundos máximo
    const checkInterval = 50; // Verifica a cada 50ms
    const startTime = Date.now();
    let lastSize = 0;
    let stableSizeCount = 0;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Verifica se o arquivo existe e tem tamanho
        const stats = await fs.stat(filePath);
        
        if (stats.size === 0) {
          // Arquivo vazio, continua esperando
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }

        // Verifica se o tamanho do arquivo está estável
        if (stats.size === lastSize) {
          stableSizeCount++;
          // Se o tamanho ficou estável por pelo menos 3 verificações (150ms)
          if (stableSizeCount >= 3) {
            // Tenta abrir o arquivo para verificar se está acessível
            const fileHandle = await fs.open(filePath, 'r');
            await fileHandle.close();
            
            logger.debug("File is ready and accessible", { 
              filePath, 
              fileSize: stats.size,
              waitTime: Date.now() - startTime 
            });
            return;
          }
        } else {
          // Tamanho mudou, resetar contador
          lastSize = stats.size;
          stableSizeCount = 0;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        // Arquivo ainda não existe ou não está acessível
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error(`Timeout waiting for file to be ready: ${filePath}`);
  }
} 