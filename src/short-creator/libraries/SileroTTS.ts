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
  private scriptPath: string;

  constructor(private config: Config) {
    this.modelPath = path.join(config.dataDirPath, "models", "silero_tts");
    this.device = "cpu"; // or "cuda" if you have NVIDIA GPU
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
    // Verify Python script exists
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(`Python script not found at ${this.scriptPath}`);
    }
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
      scriptPath: this.scriptPath,
      modelPath: this.modelPath,
      cwd: process.cwd()
    }, "🚀 Iniciando geração de áudio com YourTTS");

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
      
      const command = `python3 ${this.scriptPath} --text "${text}" --output "${outputPath}" --reference "${refPath || 'NinoSample.wav'}" --language "${language}" --emotion "${emotion}"`;
      logger.info({ command }, "🔧 Executando comando Python");
      
      const { stdout, stderr } = await execAsync(command);
      logger.info({ stdout, stderr }, "✅ Comando Python executado");
      
      logger.info({ outputPath }, "🎵 Speech generated successfully");
    } catch (error) {
      logger.error({ 
        error,
        text,
        outputPath,
        emotion,
        language,
        referenceAudioPath,
        cwd: process.cwd()
      }, "❌ Failed to generate speech");
      throw error;
    }
  }
} 