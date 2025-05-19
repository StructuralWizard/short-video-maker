import { Config } from "../../config";
import { logger } from "../../logger";
import path from "path";
import fs from "fs-extra";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class SileroTTS {
  private modelPath: string;
  private device: string;
  private referenceAudioPath: string;

  constructor(private config: Config) {
    this.modelPath = path.join(config.dataDirPath, "models", "silero_tts");
    this.device = "cpu"; // or "cuda" if you have NVIDIA GPU
    this.referenceAudioPath = config.referenceAudioPath || path.join(process.cwd(), "NinoSample.wav");
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

    // Verify reference audio exists
    if (!fs.existsSync(this.referenceAudioPath)) {
      throw new Error(`Reference audio file not found at ${this.referenceAudioPath}`);
    }
  }

  async generateSpeech(text: string, outputPath: string): Promise<void> {
    logger.debug({ text, outputPath }, "Generating speech with YourTTS");

    try {
      // Create a temporary Python script to generate audio
      const scriptPath = path.join(this.modelPath, "generate_speech.py");
      const scriptContent = `
import torch
import torchaudio
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig, XttsArgs
from TTS.config.shared_configs import BaseDatasetConfig
from torch.serialization import add_safe_globals
import re

# Add required classes to safe globals
add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

# Initialize XTTS v2 model
tts = TTS(
    model_name="tts_models/multilingual/multi-dataset/xtts_v2",
    progress_bar=False,
    gpu=torch.cuda.is_available()
)

# Map language codes to XTTS language names
language_map = {
    "pt": "pt",
    "en": "en"
}

# Get language from config or default to Portuguese
language = language_map.get("${this.config.language}", "pt")

# Preprocess text: replace punctuation with commas and ellipsis with hyphens
text = """${text.replace(/"/g, '\\"').replace(/\n/g, ', , ')}"""
text = re.sub(r'[.!?]', ',', text)  # Replace punctuation with commas
text = re.sub(r'…', '-', text)      # Replace ellipsis with hyphens
text = re.sub(r'\s*,\s*', ', ', text)  # Normalize spaces around commas
text = text.strip(', ')  # Remove leading/trailing commas and spaces

# Generate audio with voice cloning
tts.tts_to_file(
    text=text,
    file_path="${outputPath}",
    speaker_wav="${this.referenceAudioPath}",
    language=language,
    speed=1.3,
    emotion="emotional"
)

# Post-process the audio for better quality
waveform, sample_rate = torchaudio.load("${outputPath}")
# Apply noise reduction
waveform = torchaudio.functional.vad(waveform, sample_rate)
# Save the processed audio
torchaudio.save("${outputPath}", waveform, sample_rate)
      `;

      fs.writeFileSync(scriptPath, scriptContent);

      // Execute the Python script
      await execAsync(`python3 ${scriptPath}`);
      logger.debug({ outputPath }, "Speech generated successfully");
    } catch (error) {
      logger.error({ error }, "Failed to generate speech");
      throw error;
    }
  }
} 