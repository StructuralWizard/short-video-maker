"""
Ultimate Voice Cloning Solution: XTTS v2 Fix + Chatterbox Integration
This provides both solutions to your voice cloning problem
"""

def pytorch_compatibility_fix():
    """Fix PyTorch 2.6 compatibility issue with XTTS v2"""
    print("🔧 PYTORCH 2.6 COMPATIBILITY FIX FOR XTTS v2")
    print("=" * 60)
    
    print("📋 Problem: PyTorch 2.6 changed weights_only default to True")
    print("📋 Solution: Multiple fixes implemented")
    
    fixes = [
        {
            "method": "Safe Globals Registration",
            "code": """
import torch.serialization
from TTS.tts.configs.xtts_config import XttsConfig
torch.serialization.add_safe_globals([XttsConfig])
""",
            "description": "Registers XTTS config as safe for loading"
        },
        {
            "method": "torch.load Override",
            "code": """
original_load = torch.load
torch.load = lambda *args, **kwargs: original_load(*args, **{**kwargs, 'weights_only': False})
# Load model here
torch.load = original_load  # Restore
""",
            "description": "Temporarily disables weights_only during model loading"
        }
    ]
    
    for i, fix in enumerate(fixes, 1):
        print(f"\n{i}. {fix['method']}")
        print(f"   📝 {fix['description']}")
        print(f"   💻 Code:")
        for line in fix['code'].strip().split('\n'):
            print(f"      {line}")

def chatterbox_integration_plan():
    """Create implementation plan for Chatterbox integration"""
    print("\n🚀 CHATTERBOX INTEGRATION PLAN")
    print("=" * 50)
    
    integration_steps = [
        {
            "step": "1. Install Chatterbox",
            "command": "pip install chatterbox-tts",
            "description": "Install the Chatterbox TTS library"
        },
        {
            "step": "2. Create Chatterbox Wrapper",
            "code": """
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

class ChatterboxWrapper:
    def __init__(self):
        self.model = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
        
    def generate_speech(self, text, reference_audio_path, output_path):
        wav = self.model.generate(text, audio_prompt_path=reference_audio_path)
        ta.save(output_path, wav, self.model.sr)
        return True
""",
            "description": "Wrapper class for Chatterbox integration"
        },
        {
            "step": "3. Hybrid System Implementation",
            "code": """
def select_tts_engine(voice_file):
    # Use Chatterbox for English (superior quality)
    if voice_file in ['Charlotte.WAV', 'Hamilton.WAV']:
        return 'chatterbox'
    # Use XTTS v2 for Spanish/Portuguese (multilingual support)
    else:
        return 'xtts_v2'
""",
            "description": "Smart engine selection based on language"
        }
    ]
    
    for step_info in integration_steps:
        print(f"\n📋 {step_info['step']}")
        print(f"   📝 {step_info['description']}")
        if 'command' in step_info:
            print(f"   💻 Command: {step_info['command']}")
        if 'code' in step_info:
            print(f"   💻 Code:")
            for line in step_info['code'].strip().split('\n'):
                print(f"      {line}")

def create_hybrid_tts_service():
    """Create code for hybrid TTS service"""
    print("\n🌟 HYBRID TTS SERVICE CODE")
    print("=" * 40)
    
    hybrid_code = '''
import os
import json
import torch
# PyTorch 2.6 compatibility fix
import torch.serialization
from TTS.tts.configs.xtts_config import XttsConfig
torch.serialization.add_safe_globals([XttsConfig])

from TTS.api import TTS
import soundfile as sf
from pathlib import Path
from flask import Flask, request, send_file, send_from_directory, jsonify
import threading
import logging

# Chatterbox integration
try:
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS
    CHATTERBOX_AVAILABLE = True
except ImportError:
    CHATTERBOX_AVAILABLE = False
    print("Chatterbox not installed. Install with: pip install chatterbox-tts")

class HybridTTSService:
    def __init__(self):
        self.xtts_models = {}
        self.chatterbox_model = None
        self.model_lock = threading.Lock()
        
        # Initialize Chatterbox if available
        if CHATTERBOX_AVAILABLE:
            try:
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self.chatterbox_model = ChatterboxTTS.from_pretrained(device=device)
                print("✅ Chatterbox model loaded successfully")
            except Exception as e:
                print(f"❌ Failed to load Chatterbox: {e}")
                self.chatterbox_model = None
    
    def select_engine(self, voice_file):
        """Select best TTS engine for each voice"""
        # Use Chatterbox for English if available
        if voice_file in ['Charlotte.WAV', 'Hamilton.WAV'] and self.chatterbox_model:
            return 'chatterbox'
        # Use XTTS v2 for all others (multilingual)
        return 'xtts_v2'
    
    def generate_with_chatterbox(self, text, reference_audio_path, output_path):
        """Generate speech using Chatterbox"""
        try:
            with self.model_lock:
                wav = self.chatterbox_model.generate(
                    text, 
                    audio_prompt_path=str(reference_audio_path)
                )
                ta.save(str(output_path), wav, self.chatterbox_model.sr)
            return True
        except Exception as e:
            print(f"Chatterbox generation failed: {e}")
            return False
    
    def generate_with_xtts(self, text, reference_audio_path, output_path, language):
        """Generate speech using XTTS v2 with PyTorch fix"""
        try:
            # Load XTTS model with compatibility fix
            if language not in self.xtts_models:
                original_load = torch.load
                torch.load = lambda *args, **kwargs: original_load(*args, **{**kwargs, 'weights_only': False})
                
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self.xtts_models[language] = TTS(
                    model_name="tts_models/multilingual/multi-dataset/xtts_v2"
                ).to(device)
                
                torch.load = original_load
            
            # Generate speech
            model = self.xtts_models[language]
            with self.model_lock:
                wav = model.tts(
                    text=text,
                    speaker_wav=str(reference_audio_path),
                    language=language
                )
                sf.write(str(output_path), wav, 24000)
            return True
            
        except Exception as e:
            print(f"XTTS generation failed: {e}")
            return False
    
    def generate_speech(self, text, voice_file, output_path, language):
        """Main speech generation method"""
        reference_audio_path = Path("reference_audio") / voice_file
        
        if not reference_audio_path.exists():
            print(f"Reference audio not found: {reference_audio_path}")
            return False
        
        engine = self.select_engine(voice_file)
        print(f"Using {engine} for {voice_file}")
        
        if engine == 'chatterbox':
            return self.generate_with_chatterbox(text, reference_audio_path, output_path)
        else:
            return self.generate_with_xtts(text, reference_audio_path, output_path, language)

# Usage example
if __name__ == "__main__":
    tts_service = HybridTTSService()
    
    # Test voices
    voices = {
        "Charlotte.WAV": ("en", "Hello! I'm Charlotte with perfect English voice cloning."),
        "Hamilton.WAV": ("en", "Greetings! I'm Hamilton with distinctive male English voice."),
        "Noel.WAV": ("es", "¡Hola! Soy Noel con voz española auténtica."),
        "Pilar.WAV": ("es", "¡Saludos! Soy Pilar con acento español femenino."),
        "Paulo.WAV": ("pt", "Olá! Eu sou o Paulo com sotaque português."),
        "Ines.WAV": ("pt", "Oi! Eu sou a Ines com voz portuguesa feminina.")
    }
    
    for voice_file, (language, text) in voices.items():
        output_path = Path(f"output_hybrid_{voice_file.replace('.WAV', '')}.wav")
        success = tts_service.generate_speech(text, voice_file, output_path, language)
        print(f"{'✅' if success else '❌'} {voice_file}: {output_path}")
'''
    
    print("💻 Complete Hybrid TTS Service Implementation:")
    print(hybrid_code)

def recommendation_summary():
    """Final recommendation summary"""
    print("\n🎯 FINAL RECOMMENDATION SUMMARY")
    print("=" * 50)
    
    print("🔥 BEST SOLUTION: Hybrid System")
    print("   • Chatterbox for English voices (Charlotte, Hamilton)")
    print("   • XTTS v2 with PyTorch fix for Spanish/Portuguese")
    print("   • Superior quality + Multilingual support")
    
    print("\n📋 Implementation Priority:")
    print("1. 🔧 Apply PyTorch fix to current XTTS v2 service")
    print("2. 🧪 Test if XTTS v2 voice cloning works now")
    print("3. 🚀 Install Chatterbox: pip install chatterbox-tts")
    print("4. 🌟 Implement hybrid system")
    print("5. 🎭 Compare quality: Chatterbox vs XTTS v2")
    
    print("\n💡 Expected Results:")
    print("✅ Charlotte & Hamilton: Perfect English voice cloning")
    print("✅ Noel & Pilar: Good Spanish voice cloning")
    print("✅ Paulo & Ines: Good Portuguese voice cloning")
    print("✅ Each voice sounds DIFFERENT (gender + accent)")

if __name__ == "__main__":
    print("🎭 ULTIMATE VOICE CLONING SOLUTION")
    print("=" * 60)
    
    pytorch_compatibility_fix()
    chatterbox_integration_plan()
    create_hybrid_tts_service()
    recommendation_summary()
    
    print("\n🚀 NEXT STEPS:")
    print("1. Test the PyTorch fix first")
    print("2. If XTTS v2 works, great! If not, proceed with Chatterbox")
    print("3. Implement hybrid system for best quality")
