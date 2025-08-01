import os
import json
import torch
# Fix for PyTorch 2.6 compatibility with XTTS v2 models
import torch.serialization
from TTS.tts.configs.xtts_config import XttsConfig
torch.serialization.add_safe_globals([XttsConfig])

from TTS.api import TTS
import soundfile as sf
from pathlib import Path
from flask import Flask, request, send_file, send_from_directory, jsonify
import threading
import logging

# Configurações - UPDATED TO USE XTTS v2 FOR ALL VOICES (only model that supports voice cloning)
MODELS = {
    "pt": "tts_models/multilingual/multi-dataset/xtts_v2",  # XTTS v2 for Portuguese (voice cloning capable)
    "en": "tts_models/multilingual/multi-dataset/xtts_v2",  # XTTS v2 for English (voice cloning capable)
    "es": "tts_models/multilingual/multi-dataset/xtts_v2",  # XTTS v2 for Spanish (voice cloning capable)
    "multilingual": "tts_models/multilingual/multi-dataset/xtts_v2"  # Best multilingual model with voice cloning
}

# Voice language mapping based on voice names
VOICE_LANGUAGES = {
    "Charlotte.WAV": "en",  # English voice
    "Hamilton.WAV": "en",   # English voice  
    "Noel.WAV": "es",       # Spanish voice - will try new VITS model
    "Pilar.WAV": "es",      # Spanish voice - will try new VITS model
    "Paulo.WAV": "pt",      # Portuguese voice (male)
    "Ines.WAV": "pt"        # Portuguese voice (female)
}

# Alternative mapping for multilingual model fallback
VOICE_LANGUAGES_MULTILINGUAL = {
    "Charlotte.WAV": "en",  # English
    "Hamilton.WAV": "en",   # English
    "Noel.WAV": "es",       # Spanish
    "Pilar.WAV": "es",      # Spanish  
    "Paulo.WAV": "pt",      # Portuguese (male)
    "Ines.WAV": "pt"        # Portuguese (female)
}
REFERENCE_AUDIO_DIR = Path(__file__).parent.parent.parent / "reference_audio"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "temp"

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Variável global para armazenar os modelos TTS
tts_models = {}
model_lock = threading.Lock()

def ensure_directories():
    """Garante que os diretórios necessários existam"""
    REFERENCE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_model(language="pt"):
    """Carrega o modelo TTS para o idioma especificado"""
    global tts_models
    if language not in tts_models:
        logger.info(f"Carregando modelo TTS para {language}...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        model_name = MODELS.get(language)
        if not model_name:
            logger.warning(f"Modelo para idioma '{language}' não encontrado, usando português como fallback")
            model_name = MODELS["pt"]
            language = "pt"
        
        try:
            # Fix for PyTorch 2.6 compatibility - temporarily disable weights_only
            original_load = torch.load
            torch.load = lambda *args, **kwargs: original_load(*args, **{**kwargs, 'weights_only': False})
            
            tts_models[language] = TTS(model_name=model_name).to(device)
            
            # Restore original torch.load
            torch.load = original_load
            
            logger.info(f"Modelo TTS para {language} carregado com sucesso no dispositivo: {device}")
        except Exception as e:
            logger.error(f"Erro ao carregar modelo {model_name}: {e}")
            
            # Try multilingual model as first fallback (especially good for voice cloning)
            try:
                logger.info("Tentando modelo multilingual XTTS v2...")
                multilingual_model = MODELS["multilingual"]
                tts_models[language] = TTS(model_name=multilingual_model).to(device)
                logger.info(f"Modelo multilingual carregado com sucesso no dispositivo: {device}")
            except Exception as e2:
                logger.error(f"Erro ao carregar modelo multilingual: {e2}")
                
                # Final fallback to English model
                try:
                    fallback_model = MODELS["en"]
                    logger.info(f"Tentando modelo fallback inglês: {fallback_model}")
                    tts_models[language] = TTS(model_name=fallback_model).to(device)
                    logger.info(f"Modelo fallback carregado com sucesso no dispositivo: {device}")
                except Exception as e3:
                    logger.error(f"Erro ao carregar modelo fallback: {e3}")
                    raise e3
    return tts_models[language]

def generate_speech(text, reference_audio_filename, output_path, language="pt"):
    """Gera áudio usando o modelo TTS"""
    try:
        # Remove aspas do texto
        text = text.replace('"', '').replace("'", "")
        
        # Determine the correct language based on the voice file
        voice_language = VOICE_LANGUAGES.get(reference_audio_filename, language)
        logger.info(f"Voice {reference_audio_filename} mapped to language: {voice_language}")
        
        # Carrega o modelo para o idioma especificado
        tts_model = load_model(voice_language)
        
        # Gera o áudio
        logger.info(f"Gerando áudio para: {text} (idioma: {voice_language})")
        
        with model_lock:
            # Se o modelo suporta referência de áudio, usa
            if hasattr(tts_model, 'tts') and 'speaker_wav' in tts_model.tts.__code__.co_varnames:
                ref_path = REFERENCE_AUDIO_DIR / reference_audio_filename
                if ref_path.exists():
                    logger.info(f"Usando arquivo de referência: {ref_path}")
                    # Try with language first, if it fails, try without language
                    try:
                        wav = tts_model.tts(
                            text=text,
                            speaker_wav=str(ref_path),
                            language=voice_language
                        )
                    except Exception as e:
                        if "language" in str(e) and "multi-lingual" in str(e):
                            logger.info("Modelo não suporta parâmetro de idioma, tentando sem ele...")
                            wav = tts_model.tts(
                                text=text,
                                speaker_wav=str(ref_path)
                            )
                        else:
                            raise e
                else:
                    logger.warning(f"Arquivo de referência não encontrado: {ref_path}, usando TTS simples")
                    try:
                        wav = tts_model.tts(text=text, language=voice_language)
                    except Exception as e:
                        if "language" in str(e) and "multi-lingual" in str(e):
                            logger.info("Modelo não suporta parâmetro de idioma, tentando sem ele...")
                            wav = tts_model.tts(text=text)
                        else:
                            raise e
            else:
                # Modelo simples sem referência
                logger.info("Usando TTS simples sem referência de áudio")
                try:
                    wav = tts_model.tts(text=text, language=voice_language)
                except Exception as e:
                    if "language" in str(e) and "multi-lingual" in str(e):
                        logger.info("Modelo não suporta parâmetro de idioma, tentando sem ele...")
                        wav = tts_model.tts(text=text)
                    else:
                        raise e
        
        # Salva o áudio
        sf.write(output_path, wav, 24000)
        logger.info(f"Áudio gerado com sucesso: {output_path}")
        
        return True
    except Exception as e:
        logger.error(f"Erro ao gerar áudio: {str(e)}")
        return False

@app.route('/api/tts', methods=['POST'])
def handle_tts_request():
    try:
        # Extrai os parâmetros da requisição JSON
        data = request.get_json()
        logger.info(f"Received request data: {data}")
        text = data.get("text", "")
        reference_audio_filename = data.get("reference_audio_filename")
        language = data.get("language", "pt")
        
        logger.info(f"Parameters - text: {text}, reference_audio: {reference_audio_filename}, language: {language}")
        
        if not reference_audio_filename:
            return jsonify({"error": "reference_audio_filename é obrigatório"}), 400

        # Gera um nome único para o arquivo de saída
        output_filename = f"generated_{hash(text + reference_audio_filename)}.wav"
        output_path = OUTPUT_DIR / output_filename
        
        logger.info(f"Generated output path: {output_path}")
        
        # Gera o áudio
        success = generate_speech(text, reference_audio_filename, output_path, language)
        
        logger.info(f"Audio generation result: {success}")
        
        if success:
            # Retorna o link para download em JSON
            download_link = f"/api/download/{output_filename}"
            logger.info(f"Returning download link: {download_link}")
            return jsonify({"download_link": download_link})
        else:
            logger.error("Audio generation failed")
            return jsonify({"error": "Falha ao gerar áudio"}), 500
            
    except Exception as e:
        logger.error(f"Erro ao processar requisição: {str(e)}")
        return jsonify({"error": f"Erro interno do servidor: {str(e)}"}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """Rota para servir os arquivos de áudio gerados."""
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint para verificar se o serviço está funcionando"""
    return {"status": "ok", "models_loaded": list(tts_models.keys())}

def main():
    """Função principal que inicia o serviço"""
    try:
        ensure_directories()
        # Carrega o modelo português por padrão na inicialização
        load_model("pt")
        
        # Inicia o servidor Flask
        port = int(os.environ.get('PORT', 5003))
        app.run(host='0.0.0.0', port=port, debug=True)
        
    except Exception as e:
        logger.error(f"Erro ao iniciar o serviço: {str(e)}")
        raise

if __name__ == "__main__":
    main() 