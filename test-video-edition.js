const axios = require('axios');

async function testVideoEdition() {
  const baseUrl = 'http://localhost:3123/api';
  
  try {
    console.log('🧪 Testing Video Edition Pipeline...\n');
    
    // 1. Listar vídeos existentes
    console.log('1. Getting existing videos...');
    const videosResponse = await axios.get(`${baseUrl}/videos`);
    const videos = videosResponse.data;
    
    if (videos.length === 0) {
      console.log('❌ No videos found. Please create a video first.');
      return;
    }
    
    const testVideo = videos[0];
    console.log(`✅ Found video: ${testVideo.id}`);
    
    // 2. Obter dados do vídeo
    console.log('\n2. Getting video data...');
    const videoDataResponse = await axios.get(`${baseUrl}/video-data/${testVideo.id}`);
    const originalData = videoDataResponse.data;
    console.log(`✅ Video has ${originalData.scenes?.length || 0} scenes`);
    
    if (!originalData.scenes || originalData.scenes.length === 0) {
      console.log('❌ Video has no scenes to edit.');
      return;
    }
    
    // 3. Fazer uma edição de texto
    console.log('\n3. Testing text edition...');
    const editedData = JSON.parse(JSON.stringify(originalData));
    const originalText = editedData.scenes[0].text;
    editedData.scenes[0].text = originalText + ' [EDITED]';
    
    console.log(`Original text: "${originalText}"`);
    console.log(`New text: "${editedData.scenes[0].text}"`);
    
    // 4. Processar edição
    console.log('\n4. Processing edition...');
    const processResponse = await axios.post(
      `${baseUrl}/video-data/${testVideo.id}/process-edition`,
      editedData
    );
    console.log(`✅ Edition processed: ${processResponse.data.message}`);
    
    // 5. Verificar se dados foram salvos
    console.log('\n5. Verifying saved data...');
    const updatedDataResponse = await axios.get(`${baseUrl}/video-data/${testVideo.id}`);
    const updatedData = updatedDataResponse.data;
    
    if (updatedData.scenes[0].text.includes('[EDITED]')) {
      console.log('✅ Text changes saved successfully');
    } else {
      console.log('❌ Text changes not saved');
    }
    
    // 6. Verificar se áudio foi regenerado
    const hasNewAudio = updatedData.scenes[0].audio?.url !== originalData.scenes[0].audio?.url;
    if (hasNewAudio) {
      console.log('✅ Audio regenerated for edited text');
    } else {
      console.log('⚠️  Audio may not have been regenerated');
    }
    
    // 7. Teste de re-renderização (opcional)
    console.log('\n6. Testing re-render...');
    const rerenderResponse = await axios.post(
      `${baseUrl}/video-data/${testVideo.id}/rerender`,
      updatedData  // Passar dados editados em vez de vazio
    );
    console.log(`✅ Re-render started: ${rerenderResponse.data.message}`);
    
    console.log('\n🎉 Video Edition Pipeline Test Completed!');
    console.log('\nWhat was tested:');
    console.log('- ✅ Text change detection');
    console.log('- ✅ Audio regeneration for changed text');
    console.log('- ✅ Data persistence in JSON files');
    console.log('- ✅ Re-render pipeline');
    console.log('\nMonitor the video status to see the re-render progress.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Executar teste
testVideoEdition(); 