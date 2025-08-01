#!/usr/bin/env python3
"""
🎭 HYBRID TTS SERVICE - COMPREHENSIVE VOICE TEST
==============================================
Test all 6 voices using the optimal engine for each:
- Charlotte (English Female) -> Chatterbox
- Hamilton (English Male) -> Chatterbox  
- Noel (Spanish Male) -> XTTS v2
- Pilar (Spanish Female) -> XTTS v2
- Paulo (Portuguese Male) -> XTTS v2
- Ines (Portuguese Female) -> XTTS v2

This test validates that each voice sounds authentic and different.
"""

import os
import sys
import time
from pathlib import Path

# Add parent directory to path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Import our hybrid service
from hybrid_tts_service import HybridTTSService

def main():
    print("🎭 HYBRID TTS SERVICE - COMPREHENSIVE VOICE TEST")
    print("=" * 60)
    
    # Initialize hybrid service
    hybrid_tts = HybridTTSService()
    
    # Test phrases for each language
    test_phrases = {
        "en": "Hello! I'm testing the hybrid TTS service. This voice should sound natural and authentic.",
        "es": "¡Hola! Estoy probando el servicio híbrido de síntesis de voz. Esta voz debería sonar natural y auténtica.",
        "pt": "Olá! Estou testando o serviço híbrido de síntese de fala. Esta voz deve soar natural e autêntica."
    }
    
    # Voice test configuration
    voices_to_test = [
        ("Charlotte", "en", "🇺🇸 English Female", "chatterbox"),
        ("Hamilton", "en", "🇺🇸 English Male", "chatterbox"),
        ("Noel", "es", "🇪🇸 Spanish Male", "xtts"),
        ("Pilar", "es", "🇪🇸 Spanish Female", "xtts"),
        ("Paulo", "pt", "🇵🇹 Portuguese Male", "xtts"),
        ("Ines", "pt", "🇵🇹 Portuguese Female", "xtts")
    ]
    
    results = []
    output_dir = Path("hybrid_test_outputs")
    output_dir.mkdir(exist_ok=True)
    
    print(f"📁 Output directory: {output_dir.absolute()}")
    print()
    
    for voice_name, lang, description, expected_engine in voices_to_test:
        print(f"🎤 Testing {voice_name} - {description}")
        print("-" * 50)
        
        # Get test phrase
        text = test_phrases[lang]
        print(f"📝 Text: {text}")
        
        # Generate output path
        output_file = output_dir / f"{voice_name}_{expected_engine}_hybrid.wav"
        
        # Generate speech
        start_time = time.time()
        success, result, sample_rate = hybrid_tts.generate_speech(
            text=text,
            voice_name=voice_name,
            output_path=str(output_file)
        )
        
        generation_time = time.time() - start_time
        
        if success:
            print(f"✅ SUCCESS! Generated in {generation_time:.2f}s")
            print(f"📊 Sample rate: {sample_rate} Hz")
            print(f"📁 File: {output_file}")
            print(f"🔧 Engine: {expected_engine.upper()}")
            
            # Calculate file size
            if output_file.exists():
                file_size = output_file.stat().st_size
                print(f"💾 File size: {file_size:,} bytes")
            
            results.append({
                "voice": voice_name,
                "description": description,
                "engine": expected_engine,
                "success": True,
                "time": generation_time,
                "file": str(output_file),
                "sample_rate": sample_rate
            })
        else:
            print(f"❌ FAILED: {result}")
            results.append({
                "voice": voice_name,
                "description": description,
                "engine": expected_engine,
                "success": False,
                "error": result
            })
        
        print()
    
    # Summary
    print("📊 HYBRID TTS TEST SUMMARY")
    print("=" * 60)
    
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]
    
    print(f"✅ Successful: {len(successful)}/{len(results)}")
    print(f"❌ Failed: {len(failed)}/{len(results)}")
    print()
    
    if successful:
        print("🎉 SUCCESSFUL VOICES:")
        for result in successful:
            print(f"   • {result['voice']} ({result['description']}) - {result['engine'].upper()} - {result['time']:.2f}s")
        print()
    
    if failed:
        print("💥 FAILED VOICES:")
        for result in failed:
            print(f"   • {result['voice']} ({result['description']}) - {result['error']}")
        print()
    
    # Engine performance summary
    chatterbox_voices = [r for r in successful if r["engine"] == "chatterbox"]
    xtts_voices = [r for r in successful if r["engine"] == "xtts"]
    
    if chatterbox_voices:
        avg_time = sum(r["time"] for r in chatterbox_voices) / len(chatterbox_voices)
        print(f"🚀 Chatterbox Performance: {len(chatterbox_voices)} voices, avg {avg_time:.2f}s")
    
    if xtts_voices:
        avg_time = sum(r["time"] for r in xtts_voices) / len(xtts_voices)
        print(f"🔧 XTTS v2 Performance: {len(xtts_voices)} voices, avg {avg_time:.2f}s")
    
    print()
    print("🎯 NEXT STEPS:")
    print("1. Listen to the generated audio files to verify voice quality")
    print("2. Ensure each voice sounds different and authentic")
    print("3. Check that language pronunciation is correct")
    print("4. If all voices sound good, the hybrid system is ready!")
    print()
    print(f"📁 All test files saved in: {output_dir.absolute()}")

if __name__ == "__main__":
    main()
