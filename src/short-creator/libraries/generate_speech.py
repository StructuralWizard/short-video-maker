import torch
import torchaudio
from TTS.api import TTS
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import XttsAudioConfig, XttsArgs
from TTS.config.shared_configs import BaseDatasetConfig
from torch.serialization import add_safe_globals
import re
import os
import argparse

# Add required classes to safe globals
add_safe_globals([XttsConfig, XttsAudioConfig, BaseDatasetConfig, XttsArgs])

def generate_speech(text: str, output_path: str, reference_audio_path: str, language: str = "pt", emotion: str = "emotional"):
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
    language = language_map.get(language, "pt")

    # Remove previous output audio if exists
    if os.path.exists(output_path):
        os.remove(output_path)

    # Add pauses at start and end, remove extra spaces and replace newlines with spaces
    #text = " , , , " + text.strip().replace("\n", " ") + " , , , "
    text = text.strip().replace("\n", " ")
    text = text.strip().replace(".", ", ")
    # if text.strip().endswith("."):
    #     text = text.strip()[:-1]
    print(f"[DEBUG] Preprocessed text: {text}")

    print(f"[DEBUG] Language for TTS: {language}")

    print("[DEBUG] Starting TTS generation...")
    # Generate audio with voice cloning
    tts.tts_to_file(
        text=text,
        file_path=output_path,
        speaker_wav=reference_audio_path,
        language=language,
        speed=1.3,
        emotion=emotion
    )
    print(f"[DEBUG] Audio saved to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate speech using XTTS v2')
    parser.add_argument('--text', required=True, help='Text to convert to speech')
    parser.add_argument('--output', required=True, help='Output audio file path')
    parser.add_argument('--reference', required=True, help='Reference audio file path')
    parser.add_argument('--language', default='pt', help='Language code (pt or en)')
    parser.add_argument('--emotion', default='emotional', help='Emotion for TTS (emotional, neutral, question, etc)')
    
    args = parser.parse_args()
    generate_speech(args.text, args.output, args.reference, args.language, args.emotion) 