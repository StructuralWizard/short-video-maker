#!/bin/bash

# Script para limpar o banco de dados de vídeos
# Uso: ./scripts/clear-videos.sh

echo "🧹 Iniciando limpeza do banco de dados..."

# Verificar se o Node.js está disponível
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js primeiro."
    exit 1
fi

# Executar o script de limpeza
echo "CONFIRMAR" | node scripts/clear-videos.js

echo "✅ Limpeza concluída!" 