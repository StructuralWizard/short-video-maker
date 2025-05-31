#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const [,, inputPath, outputPathArg] = process.argv;
  if (!inputPath) {
    console.error('Usage: node generate-video.js <input.json> [output.mp4]');
    process.exit(1);
  }

  // Read and parse JSON
  let json;
  try {
    let raw = fs.readFileSync(inputPath, 'utf8');
    // Remove blocos de markdown ```json ou ```
    raw = raw.replace(/^```json\s*/i, '')
             .replace(/^```\s*/i, '')
             .replace(/```\s*$/i, '')
             .trim();
    // Remove qualquer linha inicial ou final que seja só ```
    raw = raw.replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    json = JSON.parse(raw);
    if (Array.isArray(json)) {
      json = json[0];
    }
  } catch (err) {
    console.error('Failed to read or parse JSON:', err.message);
    process.exit(1);
  }

  // POST to API
  let videoId;
  try {
    const res = await axios.post('http://localhost:3123/api/short-video', json, {
      headers: { 'Content-Type': 'application/json' }
    });
    videoId = res.data.videoId;
    if (!videoId) throw new Error('No videoId in response');
    console.log('Video ID:', videoId);
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

  // Poll for status
  let status = '';
  while (status !== 'ready') {
    try {
      const res = await axios.get(`http://localhost:3123/api/short-video/${videoId}/status`);
      status = res.data.status;
      console.log(`Status: ${status}`);
      if (status !== 'ready') await new Promise(r => setTimeout(r, 10000));
    } catch (err) {
      console.error('Error checking status:', err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  // Download video
  const outputPath = outputPathArg || path.join(
    path.dirname(inputPath),
    path.basename(inputPath, path.extname(inputPath)) + '.mp4'
  );
  try {
    const res = await axios.get(`http://localhost:3123/api/short-video/${videoId}`, { responseType: 'stream' });
    const writer = fs.createWriteStream(outputPath);
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log('Video saved to', outputPath);
  } catch (err) {
    console.error('Failed to download video:', err.message);
    process.exit(1);
  }
}

main(); 
