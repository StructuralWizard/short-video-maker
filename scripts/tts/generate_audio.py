import os
import sys
import json
import torch
from TTS.api import TTS
import soundfile as sf
import numpy as np
from pathlib import Path

# Configurações
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
REFERENCE_AUDIO_DIR = Path(__file__).parent.parent.parent / "reference_audio"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "temp"

def ensure_directories():
    """Garante que os diretórios necessários existam"""
    REFERENCE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_model():
    """Carrega o modelo TTS"""
    print("Carregando modelo TTS...", file=sys.stderr)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS(model_name=MODEL_NAME).to(device)
    return tts

def generate_speech(text, reference_audio, output_path, language="pt", emotion="neutral"):
    """Gera áudio usando o modelo TTS"""
    try:
        # Carrega o modelo
        tts = load_model()
        
        # Verifica se o arquivo de referência existe
        ref_path = REFERENCE_AUDIO_DIR / reference_audio
        if not ref_path.exists():
            raise FileNotFoundError(f"Arquivo de referência não encontrado: {ref_path}")
        
        # Remove aspas do texto
        text = text.replace('"', '').replace("'", "")
        
        # Gera o áudio
        print(f"Gerando áudio para: {text}", file=sys.stderr)
        print(f"Usando arquivo de referência: {ref_path}", file=sys.stderr)
        
        # Redireciona a saída do TTS para stderr
        original_stdout = sys.stdout
        sys.stdout = sys.stderr
        
        wav = tts.tts(
            text=text,
            speaker_wav=str(ref_path),
            language=language
        )
        
        # Restaura a saída padrão
        sys.stdout = original_stdout
        
        # Salva o áudio
        sf.write(output_path, wav, 24000)
        print(f"Áudio gerado com sucesso: {output_path}", file=sys.stderr)
        
        return True
    except Exception as e:
        print(f"Erro ao gerar áudio: {str(e)}", file=sys.stderr)
        return False

def main():
    """Função principal que processa requisições via stdin"""
    try:
        ensure_directories()
        
        # Lê a requisição do stdin
        print("Aguardando entrada...", file=sys.stderr)
        input_data = sys.stdin.read()
        print(f"Recebido: {input_data}", file=sys.stderr)
        
        request = json.loads(input_data)
        
        # Extrai os parâmetros
        text = request.get("text", "")
        reference_audio = request.get("reference_audio", "")
        language = request.get("language", "pt")
        emotion = request.get("emotion", "neutral")
        
        # Gera um nome único para o arquivo de saída
        output_filename = f"generated_{hash(text + reference_audio)}.wav"
        output_path = OUTPUT_DIR / output_filename
        
        # Gera o áudio
        success = generate_speech(text, reference_audio, output_path, language, emotion)
        
        # Retorna o resultado
        if success:
            response = {
                "success": True,
                "output_path": str(output_path)
            }
        else:
            response = {
                "success": False,
                "error": "Falha ao gerar áudio"
            }
        
        # Garante que apenas o JSON seja enviado para stdout
        print(json.dumps(response), flush=True)
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Erro ao decodificar JSON: {str(e)}"
        }), flush=True)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Erro inesperado: {str(e)}"
        }), flush=True)

if __name__ == "__main__":
    main() 