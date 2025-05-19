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
    progress_bar=True,  # Enable progress bar for testing
    gpu=torch.cuda.is_available()
)

# Test text in Portuguese
text = " , , , Vivemos em uma geração que esqueceu o peso da honra , , , "
# Preprocess text: replace punctuation with commas and ellipsis with hyphens
text = ", , " + text.replace("\n", ", , ")
text = re.sub(r'[.!?]', ',', text)  # Replace punctuation with commas
text = re.sub(r'…', '-', text)      # Replace ellipsis with hyphens
text = re.sub(r'\s*,\s*', ', ', text)  # Normalize spaces around commas
text = f" , , , {text} , , , "
output_path = "test_output.wav"
reference_audio = "Noel.mp3"  # Make sure this file exists in the same directory

print("Generating speech...")
# Generate audio with voice cloning
tts.tts_to_file(
    text=text,
    file_path=output_path,
    speaker_wav=reference_audio,
    language="pt",
    speed=1.3,
    emotion="emotional"
)

print("Speech generated successfully!")
print(f"Output saved to: {output_path}") 