#!/bin/bash

# Função para parar processos em background quando o script for interrompido
cleanup() {
    echo "Parando serviços..."
    if [ ! -z "$TTS_PID" ]; then
        kill $TTS_PID 2>/dev/null
    fi
    exit 0
}

# Configurar trap para cleanup
trap cleanup SIGINT SIGTERM

# Configurar variáveis de ambiente
export PORT=3123
export TTS_SERVER_URL=http://localhost:5003
export VIDEO_SERVER_URL=http://localhost:8000
export LOG_LEVEL=info
export DEV=true
export CONCURRENCY=1
export RUNNING_IN_DOCKER=false

echo "📝 Configurações dos servidores:"
echo "   - Servidor principal: http://localhost:$PORT"
echo "   - Serviço TTS: $TTS_SERVER_URL" 
echo "   - Serviço de vídeos: $VIDEO_SERVER_URL"

# Iniciar serviço TTS em background
echo "Iniciando serviço TTS..."
cd scripts/tts
PORT=5003 python tts_service.py > ../../logs/tts-service.log 2>&1 &
TTS_PID=$!
cd ../..

# Aguardar o TTS inicializar
echo "Aguardando TTS inicializar..."
sleep 15

# Verificar se TTS está rodando
if curl -X POST -H "Content-Type: application/json" -d '{"text":"teste","reference_audio_filename":"Paulo","language":"pt"}' http://localhost:5003/api/tts > /dev/null 2>&1; then
    echo "✅ Serviço TTS iniciado com sucesso na porta 5003"
else
    echo "❌ Falha ao iniciar serviço TTS"
    exit 1
fi

echo "Iniciando servidor principal..."

# Cria o diretório de logs se não existir
mkdir -p logs

# Nome do arquivo de log com timestamp
LOG_FILE="logs/server-$(date +%Y%m%d-%H%M%S).log"

# Inicia o servidor em segundo plano com variáveis de ambiente
echo "🚀 Iniciando o servidor..."
nohup npm run dev > "$LOG_FILE" 2>&1 &

# Salva o PID do processo
echo $! > .server.pid

echo "✅ Servidor iniciado em segundo plano"
echo "📝 Logs disponíveis em: $LOG_FILE"
echo "🔍 Para ver os logs em tempo real, use: tail -f $LOG_FILE" 