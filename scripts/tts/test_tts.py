import json
import subprocess
import sys
from pathlib import Path

def test_tts():
    """Testa a geração de áudio"""
    # Cria uma requisição de teste
    request = {
        "text": "Olá, este é um teste do sistema de geração de áudio.",
        "reference_audio": "NinoCoelho.wav",
        "language": "pt",
        "emotion": "neutral"
    }
    
    # Converte a requisição para JSON
    request_json = json.dumps(request)
    print(f"Enviando requisição: {request_json}")
    
    # Executa o script de geração de áudio
    try:
        result = subprocess.run(
            [sys.executable, "generate_audio.py"],
            input=request_json,
            capture_output=True,
            text=True,
            check=True
        )
        
        print(f"Saída do script: {result.stdout}")
        print(f"Erro do script: {result.stderr}")
        
        # Verifica o resultado
        if result.stdout.strip():
            response = json.loads(result.stdout)
            if response.get("success"):
                print("✅ Teste concluído com sucesso!")
                print(f"Arquivo gerado: {response['output_path']}")
            else:
                print("❌ Erro na geração do áudio:")
                print(response.get("error", "Erro desconhecido"))
        else:
            print("❌ Nenhuma saída recebida do script")
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao executar o script (código {e.returncode}):")
        print(f"Saída: {e.stdout}")
        print(f"Erro: {e.stderr}")
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao decodificar JSON: {str(e)}")
        print(f"Conteúdo recebido: {result.stdout}")
    except Exception as e:
        print(f"❌ Erro durante o teste: {str(e)}")

if __name__ == "__main__":
    test_tts() 