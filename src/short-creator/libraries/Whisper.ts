import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
} from "@remotion/install-whisper-cpp";
import path from "path";

import { Config } from "../../config";
import type { Caption } from "../../types/shorts";
import { logger } from "../../logger";

export const ErrorWhisper = new Error("There was an error with WhisperCpp");

// Define supported languages using ISO codes
export type Language = "en" | "pt" | "auto";

export class Whisper {
  constructor(private config: Config) {}

  static async init(config: Config): Promise<Whisper> {
    if (!config.runningInDocker) {
      logger.debug("Installing WhisperCpp");
      await installWhisperCpp({
        to: config.whisperInstallPath,
        version: config.whisperVersion,
        printOutput: true,
      });
      logger.debug("WhisperCpp installed");
      logger.debug("Downloading Whisper model");
      await downloadWhisperModel({
        model: config.whisperModel,
        folder: path.join(config.whisperInstallPath, "models"),
        printOutput: config.whisperVerbose,
        onProgress: (downloadedBytes, totalBytes) => {
          const progress = `${Math.round((downloadedBytes / totalBytes) * 100)}%`;
          logger.debug(
            { progress, model: config.whisperModel },
            "Downloading Whisper model",
          );
        },
      });
      // todo run the jfk command to check if everything is ok
      logger.debug("Whisper model downloaded");
    }

    return new Whisper(config);
  }

  // Função utilitária para limpar tags indesejadas do texto
  private cleanCaptionText(text: string): string {
    // Remove tags HTML-like e caracteres isolados <, >, /, i
    // Remove tags como <i>, </i>, <b>, etc.
    return text.replace(/<.*?>/g, "").replace(/[<>/]/g, "").replace(/^i$/i, "");
  }

  // todo shall we extract it to a Caption class?
  async CreateCaption(audioPath: string, language: string = "auto"): Promise<Caption[]> {
    logger.debug({ audioPath }, "Starting to transcribe audio");
    let whisperLang = language || "auto";
    logger.debug({ audioPath, whisperLang }, "Language used for Whisper");
    const { transcription } = await transcribe({
      model: this.config.whisperModel,
      whisperPath: this.config.whisperInstallPath,
      modelFolder: path.join(this.config.whisperInstallPath, "models"),
      whisperCppVersion: this.config.whisperVersion,
      inputPath: audioPath,
      tokenLevelTimestamps: true,
      printOutput: this.config.whisperVerbose,
      language: whisperLang as Language,
      onProgress: (progress) => {
        logger.debug({ audioPath }, `Transcribing is ${progress} complete`);
      },
    });
    logger.debug({ audioPath }, "Transcription finished, creating captions");

    const captions: Caption[] = [];
    transcription.forEach((record) => {
      if (record.text === "") {
        return;
      }

      record.tokens.forEach((token) => {
        if (token.text.startsWith("[_TT")) {
          return;
        }
        // Limpa o texto do token
        const cleanText = this.cleanCaptionText(token.text);
        if (!cleanText.trim()) {
          return;
        }
        // Detecta emoção
        let emotion: "question" | "exclamation" | "neutral" = "neutral";
        if (cleanText.trim().endsWith("?")) {
          emotion = "question";
        } else if (cleanText.trim().endsWith("!")) {
          emotion = "exclamation";
        }
        // if token starts without space and the previous node didn't have space either, merge them
        if (
          captions.length > 0 &&
          !cleanText.startsWith(" ") &&
          !captions[captions.length - 1].text.endsWith(" ")
        ) {
          captions[captions.length - 1].text += cleanText;
          captions[captions.length - 1].endMs = record.offsets.to;
          // Atualiza emoção se necessário
          if (emotion !== "neutral") {
            captions[captions.length - 1].emotion = emotion;
          }
          return;
        }
        captions.push({
          text: cleanText,
          startMs: record.offsets.from,
          endMs: record.offsets.to,
          emotion,
        });
      });
    });
    logger.debug({ audioPath, captions }, "Captions created");
    return captions;
  }
}
