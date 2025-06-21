import os
import json
import torch
from TTS.api import TTS
import soundfile as sf
from pathlib import Path
from flask import Flask, request, send_file, send_from_directory, jsonify
import threading
import logging

# Configurações
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
REFERENCE_AUDIO_DIR = Path(__file__).parent.parent.parent / "reference_audio"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "temp"

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Variável global para armazenar o modelo TTS
tts_model = None
model_lock = threading.Lock()

def ensure_directories():
    """Garante que os diretórios necessários existam"""
    REFERENCE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_model():
    """Carrega o modelo TTS"""
    global tts_model
    if tts_model is None:
        logger.info("Carregando modelo TTS...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        tts_model = TTS(model_name=MODEL_NAME).to(device)
        logger.info(f"Modelo TTS carregado com sucesso no dispositivo: {device}")
    return tts_model

def generate_speech(text, reference_audio_filename, output_path, language="pt"):
    """Gera áudio usando o modelo TTS"""
    try:
        # Verifica se o arquivo de referência existe no diretório de referência
        ref_path = REFERENCE_AUDIO_DIR / reference_audio_filename
        if not ref_path.exists():
            raise FileNotFoundError(f"Arquivo de referência não encontrado: {ref_path}")
        
        # Remove aspas do texto
        text = text.replace('"', '').replace("'", "")
        
        # Gera o áudio
        logger.info(f"Gerando áudio para: {text}")
        logger.info(f"Usando arquivo de referência: {ref_path}")
        
        with model_lock:
            wav = tts_model.tts(
                text=text,
                speaker_wav=str(ref_path),
                language=language
            )
        
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
        text = data.get("text", "")
        reference_audio_filename = data.get("reference_audio_filename")
        language = data.get("language", "pt")
        
        if not reference_audio_filename:
            return jsonify({"error": "reference_audio_filename é obrigatório"}), 400

        # Gera um nome único para o arquivo de saída
        output_filename = f"generated_{hash(text + reference_audio_filename)}.wav"
        output_path = OUTPUT_DIR / output_filename
        
        # Gera o áudio
        success = generate_speech(text, reference_audio_filename, output_path, language)
        
        if success:
            # Retorna o link para download em JSON
            download_link = f"/api/download/{output_filename}"
            return jsonify({"download_link": download_link})
        else:
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
    return {"status": "ok", "model_loaded": tts_model is not None}

def main():
    """Função principal que inicia o serviço"""
    try:
        ensure_directories()
        # Carrega o modelo na inicialização
        load_model()
        
        # Inicia o servidor Flask
        port = int(os.environ.get('PORT', 5001))
        app.run(host='0.0.0.0', port=port)
        
    except Exception as e:
        logger.error(f"Erro ao iniciar o serviço: {str(e)}")
        raise

if __name__ == "__main__":
    main() 