#!/usr/bin/env python3
"""
Quick test for Portuguese voice
"""

import requests
import json

def test_portuguese_voice():
    service_url = "http://localhost:5003"
    
    print("🇧🇷 Testing Portuguese voice (Paulo)...")
    try:
        test_data = {
            "text": "Olá, este é um teste do Paulo",
            "voice": "Paulo"
        }
        response = requests.post(
            f"{service_url}/generate", 
            json=test_data, 
            timeout=60,
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Content-Type: {response.headers.get('Content-Type')}")
            print(f"   Content-Length: {len(response.content)} bytes")
            print("   ✅ Portuguese generation works!")
        else:
            print(f"   ❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Portuguese generation failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    test_portuguese_voice()
