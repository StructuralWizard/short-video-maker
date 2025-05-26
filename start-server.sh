#!/bin/bash

# Cria o diretório de logs se não existir
mkdir -p logs

# Nome do arquivo de log com timestamp
LOG_FILE="logs/server-$(date +%Y%m%d-%H%M%S).log"

# Inicia o servidor em segundo plano
echo "🚀 Iniciando o servidor..."
nohup npm run dev > "$LOG_FILE" 2>&1 &

# Salva o PID do processo
echo $! > .server.pid

echo "✅ Servidor iniciado em segundo plano"
echo "📝 Logs disponíveis em: $LOG_FILE"
echo "🔍 Para ver os logs em tempo real, use: tail -f $LOG_FILE" 