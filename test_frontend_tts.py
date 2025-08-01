#!/usr/bin/env python3
"""
Test the frontend TTS API to see the complete flow
"""

import requests
import json

def test_frontend_tts_api():
    frontend_url = "http://localhost:3121"
    
    print("🌐 Testing Frontend TTS API")
    print("=" * 40)
    
    # Test with Charlotte (English - should use Chatterbox)
    print("1. Testing Charlotte (English - Chatterbox)...")
    try:
        test_data = {
            "text": "Hello, this is Charlotte speaking",
            "voice": "Charlotte",
            "language": "en"
        }
        response = requests.post(
            f"{frontend_url}/api/generate-tts", 
            json=test_data, 
            timeout=200,  # Long timeout for Chatterbox
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            print("   ✅ Charlotte (Chatterbox) works through frontend!")
        else:
            print(f"   ❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Charlotte test failed: {e}")
        return False
    
    # Test with Paulo (Portuguese - should use XTTS)
    print("\n2. Testing Paulo (Portuguese - XTTS)...")
    try:
        test_data = {
            "text": "Olá, aqui é o Paulo falando",
            "voice": "Paulo",
            "language": "pt"
        }
        response = requests.post(
            f"{frontend_url}/api/generate-tts", 
            json=test_data, 
            timeout=60,
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            print("   ✅ Paulo (XTTS) works through frontend!")
        else:
            print(f"   ❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Paulo test failed: {e}")
        return False
    
    print("\n🎉 All frontend TTS tests passed!")
    return True

if __name__ == "__main__":
    test_frontend_tts_api()
