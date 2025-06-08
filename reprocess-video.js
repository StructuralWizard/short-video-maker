#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const [,, videoId, orientation, suffix] = process.argv;
  if (!videoId) {
    console.error('Usage: node reprocess-video.js <videoId> [orientation] [suffix]');
    console.error('orientation: portrait (default) or landscape');
    console.error('suffix: optional suffix for the output file (e.g. _landscape)');
    process.exit(1);
  }

  // Lê o arquivo JSON do vídeo
  const jsonPath = path.join(process.cwd(), 'data', 'videos', `${videoId}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON file not found for video ${videoId}`);
    console.error(`Expected path: ${jsonPath}`);
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error('Failed to read or parse JSON:', err.message);
    process.exit(1);
  }

  // Modifica a orientação se especificada
  if (orientation === 'landscape') {
    if (!json.config) json.config = {};
    json.config.orientation = 'landscape';
  }

  // Adiciona o sufixo se especificado
  if (suffix) {
    if (!json.config) json.config = {};
    json.config.outputSuffix = suffix;
  }

  // POST para a API
  try {
    console.log('Sending video for reprocessing...');
    const res = await axios.post('http://localhost:3123/api/short-video', json, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const newVideoId = res.data.videoId;
    if (!newVideoId) throw new Error('No videoId in response');
    console.log('New Video ID:', newVideoId);

    // Poll para status
    let status = '';
    while (status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
      
      try {
        const statusRes = await axios.get(`http://localhost:3123/api/short-video/${newVideoId}/status`);
        status = statusRes.data.status;
        console.log('Status:', status);
        
        if (status === 'failed') {
          console.error('Video processing failed');
          process.exit(1);
        }
      } catch (err) {
        console.error('Failed to get status:', err.message);
        process.exit(1);
      }
    }

    const outputSuffix = suffix ? suffix : (orientation === 'landscape' ? '_landscape' : '');
    console.log('Video reprocessing completed successfully!');
    console.log(`New video available at: ${newVideoId}${outputSuffix}.mp4`);
  } catch (err) {
    if (err.response) {
      console.error('Failed to POST to API:');
      console.error('Status:', err.response.status);
      console.error('Response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Failed to POST to API:', err.message);
    }
    process.exit(1);
  }
}

main().catch(console.error); 