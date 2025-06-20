#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

// Configuração
const dataDir = path.join(process.cwd(), 'data');
const videosDir = path.join(dataDir, 'videos');
const tempDir = path.join(dataDir, 'temp');

console.log('🧹 Iniciando limpeza do banco de dados...');
console.log(`📁 Diretório de vídeos: ${videosDir}`);
console.log(`📁 Diretório temporário: ${tempDir}`);

async function clearVideos() {
  try {
    // Verificar se os diretórios existem
    if (!fs.existsSync(videosDir)) {
      console.log('❌ Diretório de vídeos não encontrado');
      return;
    }

    // Listar todos os arquivos no diretório de vídeos
    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    const metadataFiles = files.filter(file => 
      file.endsWith('.json') || file.endsWith('.jsx') || file.endsWith('.tsx')
    );

    console.log(`📊 Encontrados ${videoFiles.length} arquivos de vídeo`);
    console.log(`📊 Encontrados ${metadataFiles.length} arquivos de metadados`);

    if (videoFiles.length === 0) {
      console.log('✅ Nenhum vídeo encontrado para limpar');
      return;
    }

    // Confirmar com o usuário
    console.log('\n⚠️  ATENÇÃO: Esta ação irá deletar TODOS os vídeos!');
    console.log('Para continuar, digite "CONFIRMAR" (em maiúsculas):');
    
    // Aguardar input do usuário
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('', (input) => {
        rl.close();
        resolve(input);
      });
    });

    if (answer !== 'CONFIRMAR') {
      console.log('❌ Operação cancelada pelo usuário');
      return;
    }

    // Deletar arquivos de vídeo
    console.log('\n🗑️  Deletando arquivos de vídeo...');
    for (const file of videoFiles) {
      const filePath = path.join(videosDir, file);
      fs.removeSync(filePath);
      console.log(`   ✅ Deletado: ${file}`);
    }

    // Deletar arquivos de metadados
    console.log('\n🗑️  Deletando arquivos de metadados...');
    for (const file of metadataFiles) {
      const filePath = path.join(videosDir, file);
      fs.removeSync(filePath);
      console.log(`   ✅ Deletado: ${file}`);
    }

    // Limpar diretório temporário
    if (fs.existsSync(tempDir)) {
      console.log('\n🗑️  Limpando diretório temporário...');
      fs.emptyDirSync(tempDir);
      console.log('   ✅ Diretório temporário limpo');
    }

    console.log('\n✅ Limpeza concluída com sucesso!');
    console.log(`📊 Total de arquivos deletados: ${videoFiles.length + metadataFiles.length}`);

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  }
}

// Executar a limpeza
clearVideos(); 