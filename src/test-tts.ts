import { SileroTTS } from "./short-creator/libraries/SileroTTS";
import { Config } from "./config";
import path from "path";

async function testTTS() {
  try {
    const config = new Config();
    const tts = await SileroTTS.init(config);
    
    const testText = "Olá, este é um teste do servidor TTS.";
    const outputPath = path.join(process.cwd(), "test-output.wav");
    
    console.log("🚀 Starting TTS test...");
    console.log("Text:", testText);
    console.log("Output path:", outputPath);
    
    await tts.generateSpeech(
      testText,
      outputPath,
      "neutral",
      "pt",
      "NinoCoelho.wav"
    );
    
    console.log("✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testTTS(); 