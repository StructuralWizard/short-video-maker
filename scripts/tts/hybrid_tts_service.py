#!/usr/bin/env python3
"""
*** HYBRID TTS SERVICE - BEST ENGINE FOR EACH LANGUAGE ***
===========================================================
Intelligent TTS service that automatically selects the optimal engine:
- Chatterbox: English voices (Charlotte, Hamilton) - State-of-the-art quality
- XTTS v2: Spanish/Portuguese voices (Noel, Pilar, Paulo, Ines) - Multilingual support

Author: AI Assistant
Date: 2024
"""

import os
import sys
import logging
import soundfile as sf
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from io import BytesIO
import traceback
import threading
import time
import signal
import atexit

# Add the parent directory to the Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_requested
    logger.info(f">> Received signal {signum}, initiating graceful shutdown...")
    shutdown_requested = True
    sys.exit(0)

def cleanup():
    """Cleanup function called on exit"""
    logger.info("** Hybrid TTS Service shutting down gracefully")

# Register signal handlers and cleanup
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)
atexit.register(cleanup)

class HybridTTSService:
    """
    *** Hybrid TTS Service - Smart Engine Selection ***
    ===================================================
    """
    
    def __init__(self):
        self.chatterbox_model = None
        self.xtts_model = None
        self.reference_audio_dir = Path(__file__).parent.parent.parent / "reference_audio"
        
        # Voice configuration with optimal engines
        self.voice_config = {
            # English voices - Use Chatterbox (superior quality)
            "Charlotte": {
                "engine": "chatterbox",
                "language": "en",
                "gender": "female",
                "audio_file": "Charlotte.WAV"
            },
            "Hamilton": {
                "engine": "chatterbox", 
                "language": "en",
                "gender": "male",
                "audio_file": "Hamilton.WAV"
            },
            
            # Spanish voices - Use XTTS v2 (multilingual support)
            "Noel": {
                "engine": "xtts",
                "language": "es",
                "gender": "male", 
                "audio_file": "Noel.WAV"
            },
            "Pilar": {
                "engine": "xtts",
                "language": "es", 
                "gender": "female",
                "audio_file": "Pilar.WAV"
            },
            
            # Portuguese voices - Use XTTS v2 (multilingual support)
            "Paulo": {
                "engine": "xtts",
                "language": "pt",
                "gender": "male",
                "audio_file": "Paulo.WAV"
            },
            "Ines": {
                "engine": "xtts",
                "language": "pt",
                "gender": "female", 
                "audio_file": "Ines.WAV"
            }
        }
        
        logger.info("*** Hybrid TTS Service initialized")
    
    def _load_chatterbox(self):
        """Load Chatterbox model for English voices"""
        if self.chatterbox_model is not None:
            return True
            
        try:
            logger.info(">> Loading Chatterbox model...")
            from chatterbox import ChatterboxTTS
            
            # Load the model with device specification
            self.chatterbox_model = ChatterboxTTS.from_pretrained(device="cpu")
            logger.info("** Chatterbox model loaded successfully!")
            return True
            
        except Exception as e:
            logger.error(f"XX Failed to load Chatterbox: {e}")
            return False
    
    def _load_xtts(self):
        """Load XTTS v2 model for Spanish/Portuguese voices"""
        if self.xtts_model is not None:
            return True
            
        try:
            logger.info(">> Loading XTTS v2 model...")
            
            # Apply comprehensive PyTorch compatibility fix
            import torch
            original_load = torch.load
            def patched_load(*args, **kwargs):
                if 'weights_only' in kwargs:
                    kwargs.pop('weights_only')
                return original_load(*args, **kwargs)
            torch.load = patched_load
            
            # Add ALL required safe globals for XTTS
            from TTS.tts.configs.xtts_config import XttsConfig
            from TTS.tts.models.xtts import XttsAudioConfig, XttsArgs
            from TTS.config.shared_configs import BaseDatasetConfig
            torch.serialization.add_safe_globals([
                XttsConfig, 
                XttsAudioConfig, 
                XttsArgs,
                BaseDatasetConfig
            ])
            
            from TTS.api import TTS
            self.xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
            
            logger.info("** XTTS v2 model loaded successfully!")
            return True
            
        except Exception as e:
            logger.error(f"XX Failed to load XTTS v2: {e}")
            return False
    
    def generate_speech(self, text, voice_name, output_path=None):
        """
        >> Generate speech using the optimal engine for the voice
        
        Args:
            text (str): Text to synthesize
            voice_name (str): Voice name (Charlotte, Hamilton, Noel, Pilar, Paulo, Ines)
            output_path (str, optional): Path to save the audio file
            
        Returns:
            tuple: (success, audio_data_or_error_message, sample_rate)
        """
        try:
            # Validate voice
            if voice_name not in self.voice_config:
                return False, f"Unknown voice: {voice_name}. Available: {list(self.voice_config.keys())}", None
            
            voice_config = self.voice_config[voice_name]
            engine = voice_config["engine"]
            
            # Get reference audio path
            reference_audio_path = self.reference_audio_dir / voice_config["audio_file"]
            if not reference_audio_path.exists():
                return False, f"Reference audio not found: {reference_audio_path}", None
            
            logger.info(f"*** Generating speech for '{voice_name}' using {engine.upper()} engine")
            logger.info(f">> Text: {text[:100]}{'...' if len(text) > 100 else ''}")
            
            # Generate speech based on optimal engine
            if engine == "chatterbox":
                return self._generate_chatterbox(text, reference_audio_path, output_path)
            elif engine == "xtts":
                return self._generate_xtts(text, voice_config, reference_audio_path, output_path)
            else:
                return False, f"Unknown engine: {engine}", None
                
        except Exception as e:
            error_msg = f"Error generating speech: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            return False, error_msg, None
    
    def _generate_chatterbox(self, text, reference_audio_path, output_path):
        """Generate speech using Chatterbox (English)"""
        try:
            # Load Chatterbox if needed
            if not self._load_chatterbox():
                return False, "Failed to load Chatterbox model", None
            
            # Generate speech with correct Chatterbox API
            start_time = time.time()
            audio_data = self.chatterbox_model.generate(
                text=text,
                audio_prompt_path=str(reference_audio_path)
            )
            generation_time = time.time() - start_time
            
            # Convert tensor to numpy array if needed
            import torch
            if isinstance(audio_data, torch.Tensor):
                audio_data = audio_data.detach().cpu().numpy()
            
            # Ensure audio is 1D for mono output
            if len(audio_data.shape) > 1:
                audio_data = audio_data.squeeze()  # Remove any singleton dimensions
            
            # Get sample rate (Chatterbox typically uses 24000 Hz)
            sample_rate = self.chatterbox_model.sr  # Use model's sample rate
            
            # Save to file if requested
            if output_path:
                sf.write(output_path, audio_data, sample_rate)
                logger.info(f"** Audio saved to: {output_path}")
            
            logger.info(f"** Chatterbox generation complete! Time: {generation_time:.2f}s, Size: {len(audio_data):,} samples")
            return True, audio_data, sample_rate
            
        except Exception as e:
            return False, f"Chatterbox generation failed: {str(e)}", None
    
    def _generate_xtts(self, text, voice_config, reference_audio_path, output_path):
        """Generate speech using XTTS v2 (Spanish/Portuguese)"""
        try:
            # Load XTTS if needed
            if not self._load_xtts():
                return False, "Failed to load XTTS v2 model", None
            
            # Generate speech
            start_time = time.time()
            
            # Create temporary output file for XTTS
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                temp_output = tmp_file.name
            
            try:
                # Generate with XTTS v2
                self.xtts_model.tts_to_file(
                    text=text,
                    file_path=temp_output,
                    speaker_wav=str(reference_audio_path),
                    language=voice_config["language"]
                )
                
                generation_time = time.time() - start_time
                
                # Read the generated audio
                audio_data, sample_rate = sf.read(temp_output)
                
                # Save to final location if requested
                if output_path:
                    sf.write(output_path, audio_data, sample_rate)
                    logger.info(f"** Audio saved to: {output_path}")
                
                logger.info(f"** XTTS v2 generation complete! Time: {generation_time:.2f}s, Size: {len(audio_data):,} samples")
                return True, audio_data, sample_rate
                
            finally:
                # Clean up temp file
                if os.path.exists(temp_output):
                    os.unlink(temp_output)
            
        except Exception as e:
            return False, f"XTTS v2 generation failed: {str(e)}", None
    
    def get_available_voices(self):
        """Get list of available voices with their configurations"""
        return {
            voice: {
                "engine": config["engine"],
                "language": config["language"], 
                "gender": config["gender"]
            }
            for voice, config in self.voice_config.items()
        }

# Flask Application
app = Flask(__name__)
hybrid_tts = HybridTTSService()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Hybrid TTS Service",
        "voices": list(hybrid_tts.voice_config.keys())
    })

@app.route('/voices', methods=['GET'])
def get_voices():
    """Get available voices"""
    return jsonify({
        "voices": hybrid_tts.get_available_voices(),
        "total_voices": len(hybrid_tts.voice_config)
    })

@app.route('/generate', methods=['POST'])
def generate_speech():
    """Generate speech endpoint"""
    try:
        data = request.get_json()
        
        logger.info(f"*** /generate endpoint called with data: {data}")
        
        if not data:
            logger.error("XX No JSON data provided")
            return jsonify({"error": "No JSON data provided"}), 400
        
        text = data.get('text', '').strip()
        voice = data.get('voice', '').strip()
        
        logger.info(f">> Processing request - Text: '{text[:50]}...', Voice: '{voice}'")
        
        if not text:
            logger.error("XX Text is required")
            return jsonify({"error": "Text is required"}), 400
        
        if not voice:
            logger.error("XX Voice is required")
            return jsonify({"error": "Voice is required"}), 400
        
        # Check if voice is supported
        if voice not in hybrid_tts.voice_config:
            logger.error(f"XX Unknown voice '{voice}'. Available: {list(hybrid_tts.voice_config.keys())}")
            return jsonify({"error": f"Unknown voice: {voice}. Available: {list(hybrid_tts.voice_config.keys())}"}), 400
        
        logger.info(f"** Voice '{voice}' will use {hybrid_tts.voice_config[voice]['engine'].upper()} engine")
        
        # Generate speech
        success, result, sample_rate = hybrid_tts.generate_speech(text, voice)
        
        if not success:
            logger.error(f"XX Speech generation failed: {result}")
            return jsonify({"error": result}), 500
        
        logger.info(f"** Speech generated successfully! Sample rate: {sample_rate}, Audio length: {len(result)} samples")
        
        # Create audio file response
        audio_buffer = BytesIO()
        sf.write(audio_buffer, result, sample_rate, format='WAV')
        audio_buffer.seek(0)
        
        logger.info(f"** Returning audio file for voice '{voice}'")
        
        return send_file(
            audio_buffer,
            mimetype='audio/wav',
            as_attachment=True,
            download_name=f'{voice}_generated.wav'
        )
        
    except Exception as e:
        error_msg = f"Request failed: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 500

@app.route('/api/tts', methods=['POST'])
def handle_tts_request():
    """Legacy TTS endpoint for backward compatibility"""
    try:
        # Extract parameters from JSON request
        data = request.get_json()
        logger.info(f"Received legacy TTS request data: {data}")
        text = data.get("text", "")
        reference_audio_filename = data.get("reference_audio_filename")
        language = data.get("language", "pt")
        
        logger.info(f"Legacy TTS Parameters - text: {text}, reference_audio: {reference_audio_filename}, language: {language}")
        
        if not reference_audio_filename:
            return jsonify({"error": "reference_audio_filename é obrigatório"}), 400

        # Map reference audio filename to voice name
        voice_name = reference_audio_filename.replace('.WAV', '').replace('.wav', '')
        
        # Generate speech using the hybrid service
        success, result, sample_rate = hybrid_tts.generate_speech(text, voice_name)
        
        if not success:
            logger.error("Legacy TTS generation failed")
            return jsonify({"error": result}), 500
        
        # Save to temp file for legacy compatibility
        output_dir = Path(__file__).parent.parent.parent / "data" / "temp"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_filename = f"generated_{hash(text + reference_audio_filename)}.wav"
        output_path = output_dir / output_filename
        
        # Save the audio file
        sf.write(str(output_path), result, sample_rate)
        
        # Return download link in JSON (legacy format)
        download_link = f"/api/download/{output_filename}"
        logger.info(f"Legacy TTS returning download link: {download_link}")
        return jsonify({"download_link": download_link})
            
    except Exception as e:
        logger.error(f"Error in legacy TTS endpoint: {str(e)}")
        return jsonify({"error": f"Erro interno do servidor: {str(e)}"}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """Serve generated audio files for legacy compatibility"""
    output_dir = Path(__file__).parent.parent.parent / "data" / "temp"
    return send_file(output_dir / filename, as_attachment=True)

if __name__ == "__main__":
    print("*** HYBRID TTS SERVICE - SMART ENGINE SELECTION ***")
    print("=" * 50)
    print(">> Starting Hybrid TTS Service...")
    print(f">> Reference audio directory: {hybrid_tts.reference_audio_dir}")
    print(">> Available voices:")
    for voice, config in hybrid_tts.voice_config.items():
        print(f"   * {voice} ({config['language']}, {config['gender']}) -> {config['engine'].upper()}")
    print()
    
    # Start the Flask application
    app.run(host='0.0.0.0', port=5003, debug=False)
