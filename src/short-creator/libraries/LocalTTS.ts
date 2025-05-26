import { Config } from "../../config";
import { logger } from "../../utils/logger";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

export class LocalTTS {
  private readonly scriptPath: string;
  private outputDir: string;

  constructor(private config: Config, outputDir: string = "output/audio") {
    this.scriptPath = path.join(process.cwd(), "scripts", "tts", "generate_audio.py");
    this.outputDir = outputDir;
  }

  static async init(config: Config): Promise<LocalTTS> {
    return new LocalTTS(config);
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
      cwd: process.cwd()
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
      const request = {
        text: text.replace(/["']/g, ''),
        reference_audio: path.basename(refPath),
        language,
        emotion
      };

      // Executa o script Python
      const pythonProcess = spawn("python", [this.scriptPath], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      // Envia a requisição para o script
      pythonProcess.stdin.write(JSON.stringify(request));
      pythonProcess.stdin.end();

      // Coleta a saída
      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        const chunk = data.toString();
        // Tenta encontrar um JSON válido na saída
        const jsonMatch = chunk.match(/\{.*\}/);
        if (jsonMatch) {
          stdout = jsonMatch[0];
        } else {
          stdout += chunk;
        }
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        logger.debug("TTS Python script output:", data.toString());
      });

      // Aguarda o processo terminar
      await new Promise<void>((resolve, reject) => {
        pythonProcess.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python script exited with code ${code}`));
          }
        });
      });

      // Processa a resposta
      if (!stdout) {
        throw new Error("No response received from Python script");
      }

      const response = JSON.parse(stdout);
      
      if (!response.success) {
        throw new Error(response.error || "Falha ao gerar áudio");
      }

      // Copia o arquivo gerado para o local desejado
      await fs.copyFile(response.output_path, outputPath);
      
      logger.info("🎵 Speech generated successfully", { outputPath });
    } catch (error) {
      logger.error("❌ Failed to generate speech", {
        error,
        text,
        outputPath,
        emotion,
        language,
        referenceAudioPath,
        cwd: process.cwd()
      });
      throw error;
    }
  }
} 