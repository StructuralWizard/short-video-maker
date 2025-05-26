#!/bin/bash

# Verifica se o arquivo PID existe
if [ ! -f .server.pid ]; then
    echo "❌ Arquivo .server.pid não encontrado. O servidor pode não estar rodando."
    exit 1
fi

# Lê o PID do arquivo
PID=$(cat .server.pid)

# Verifica se o processo ainda está rodando
if ! ps -p $PID > /dev/null; then
    echo "❌ Processo $PID não encontrado. O servidor pode não estar rodando."
    rm .server.pid
    exit 1
fi

# Para o processo
echo "🛑 Parando o servidor (PID: $PID)..."
kill $PID

# Aguarda o processo terminar
for i in {1..10}; do
    if ! ps -p $PID > /dev/null; then
        echo "✅ Servidor parado com sucesso"
        rm .server.pid
        exit 0
    fi
    sleep 1
done

# Se o processo ainda estiver rodando após 10 segundos, força o encerramento
if ps -p $PID > /dev/null; then
    echo "⚠️ Forçando encerramento do servidor..."
    kill -9 $PID
    rm .server.pid
    echo "✅ Servidor forçado a parar"
fi 