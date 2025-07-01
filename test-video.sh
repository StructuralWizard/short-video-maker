#!/bin/bash

# Script para testar criação de vídeo com test.json
# Usage: ./test-video.sh

set -e

API_BASE="http://localhost:3123/api"
TEST_FILE="test.json"

echo "🎬 Testando criação de vídeo com $TEST_FILE"
echo "========================================"

# Verificar se o arquivo test.json existe
if [ ! -f "$TEST_FILE" ]; then
    echo "❌ Erro: Arquivo $TEST_FILE não encontrado!"
    exit 1
fi

# Verificar se o servidor está rodando
echo "📡 Verificando se o servidor está rodando..."
if ! curl -s "$API_BASE/../health" > /dev/null; then
    echo "❌ Erro: Servidor não está rodando em localhost:3123"
    echo "💡 Execute: npm run dev"
    exit 1
fi

echo "✅ Servidor está rodando!"

# Criar novo vídeo
echo ""
echo "🎥 Criando novo vídeo..."
RESPONSE=$(curl -s -X POST "$API_BASE/short-video" \
  -H "Content-Type: application/json" \
  -d @"$TEST_FILE")

echo "📝 Resposta: $RESPONSE"

# Extrair videoId da resposta
VIDEO_ID=$(echo "$RESPONSE" | grep -o '"videoId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
    echo "❌ Erro: Não foi possível extrair o videoId da resposta"
    echo "🔍 Resposta completa: $RESPONSE"
    exit 1
fi

echo "✅ Vídeo criado com ID: $VIDEO_ID"

# Monitorar progresso
echo ""
echo "📊 Monitorando progresso..."
echo "========================================"

while true; do
    STATUS_RESPONSE=$(curl -s "$API_BASE/short-video/$VIDEO_ID/status")
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
    STAGE=$(echo "$STATUS_RESPONSE" | grep -o '"stage":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$STATUS" ]; then
        echo "❌ Erro ao obter status"
        break
    fi
    
    echo "$(date '+%H:%M:%S') - Status: $STATUS | Progresso: ${PROGRESS:-0}% | Estágio: ${STAGE:-N/A}"
    
    if [ "$STATUS" = "ready" ]; then
        echo ""
        echo "🎉 Vídeo renderizado com sucesso!"
        echo "🎬 Acesse: http://localhost:3123/videos/$VIDEO_ID.mp4"
        echo "📱 Interface: http://localhost:3123"
        break
    elif [ "$STATUS" = "failed" ]; then
        echo ""
        echo "❌ Falha na renderização!"
        echo "🔍 Verifique os logs para mais detalhes"
        break
    elif [ "$STATUS" = "error" ]; then
        echo ""
        echo "❌ Erro na renderização!"
        ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "💥 Erro: $ERROR"
        break
    fi
    
    sleep 5
done

echo ""
echo "🏁 Teste concluído!" 