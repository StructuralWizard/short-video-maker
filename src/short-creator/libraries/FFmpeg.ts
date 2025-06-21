import ffmpeg from "fluent-ffmpeg";
import { Readable } from "node:stream";
import { logger } from "../../logger";
import { Config } from "../../config";
import path from "path";

export class FFMpeg {
  private config: Config;

  static async init(): Promise<FFMpeg> {
    return import("@ffmpeg-installer/ffmpeg").then((ffmpegInstaller) => {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      logger.info({ ffmpegPath: ffmpegInstaller.path }, "FFmpeg path set");
      return new FFMpeg(new Config());
    });
  }

  constructor(config: Config) {
    this.config = config;
  }

  async saveNormalizedAudio(
    audio: ArrayBuffer,
    outputPath: string,
  ): Promise<string> {
    logger.debug("Normalizing audio for Whisper");
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputStream)
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(16000)
        .toFormat("wav")
        .on("end", () => {
          logger.debug("Audio normalization complete");
          resolve(outputPath);
        })
        .on("error", (error: unknown) => {
          logger.error(error, "Error normalizing audio:");
          reject(error);
        })
        .save(outputPath);
    });
  }

  async createMp3DataUri(audio: ArrayBuffer): Promise<string> {
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    return new Promise((resolve, reject) => {
      const chunk: Buffer[] = [];

      ffmpeg()
        .input(inputStream)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3")
        .on("error", (err) => {
          reject(err);
        })
        .pipe()
        .on("data", (data: Buffer) => {
          chunk.push(data);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunk);
          resolve(`data:audio/mp3;base64,${buffer.toString("base64")}`);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  async saveToMp3(audio: ArrayBuffer, filePath: string): Promise<string> {
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputStream)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3")
        .save(filePath)
        .on("end", () => {
          logger.debug("Audio conversion complete");
          resolve(filePath);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const duration = metadata.format.duration;
        if (typeof duration !== 'number') {
          reject(new Error('Could not get audio duration'));
          return;
        }
        resolve(duration);
      });
    });
  }

  /**
   * Une múltiplos arquivos de áudio em sequência
   * @param inputFiles Array de caminhos dos arquivos de áudio a serem unidos
   * @param outputPath Caminho do arquivo de saída
   */
  async concatAudioFiles(inputFiles: string[], outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Adiciona cada arquivo de entrada
      inputFiles.forEach(file => {
        command.input(file);
      });

      command
        .on('error', (err) => {
          logger.error(err, "Error concatenating audio files");
          reject(err);
        })
        .on('end', () => {
          logger.debug("Audio concatenation complete");
          resolve(outputPath);
        })
        .mergeToFile(outputPath, path.dirname(outputPath));
    });
  }

  public async concatenateWithSilence(filePaths: string[], outputPath: string, silenceDuration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (filePaths.length === 0) {
        return reject(new Error("No files to concatenate."));
      }

      const command = ffmpeg();
      const complexFilter: string[] = [];
      let inputStreamIndex = 0;

      // Adiciona cada arquivo de áudio como uma entrada
      filePaths.forEach((filePath, index) => {
        command.input(filePath);
        complexFilter.push(`[${inputStreamIndex}:a]`);
        inputStreamIndex++;

        // Adiciona um atraso de silêncio entre os arquivos
        if (index < filePaths.length - 1) {
          const silenceInput = `aevalsrc=0:d=${silenceDuration}`;
          command.input(silenceInput).inputOptions('-f lavfi');
          complexFilter.push(`[${inputStreamIndex}:a]`);
          inputStreamIndex++;
        }
      });

      // Concatena todas as entradas de áudio
      command
        .complexFilter(complexFilter.join('') + `concat=n=${complexFilter.length}:v=0:a=1[outa]`)
        .outputOptions('-map', '[outa]')
        .on('error', (err) => {
          logger.error('Error concatenating audio files:', err);
          reject(err);
        })
        .on('end', () => {
          logger.info('Audio files concatenated successfully.');
          resolve();
        })
        .save(outputPath);
    });
  }
}
