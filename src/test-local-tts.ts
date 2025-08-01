import { LocalTTS } from "./short-creator/libraries/LocalTTS";
import { Config } from "./config";
import path from "path";

async function testLocalTTS() {
  try {
    const config = new Config();
    const tts = await LocalTTS.init(config);
    
    const testText = "Olá, este é um teste do TTS local.";
    const outputPath = path.join(process.cwd(), "test-output.wav");
    
    console.log("🚀 Starting local TTS test...");
    console.log("Text:", testText);
    console.log("Output path:", outputPath);
    
    await tts.generateSpeech(
      testText,
      outputPath,
      "neutral",
      "pt",
      "Paulo.wav"
    );
    
    console.log("✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testLocalTTS(); 