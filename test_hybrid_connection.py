#!/usr/bin/env python3
"""
Test script to check hybrid TTS service connection
"""

import requests
import json

def test_hybrid_service():
    service_url = "http://localhost:5003"
    
    print("🔍 Testing Hybrid TTS Service Connection")
    print("=" * 50)
    
    # Test health endpoint
    print("1. Testing /health endpoint...")
    try:
        response = requests.get(f"{service_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        print("   ✅ Health check passed!")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return False
    
    # Test voices endpoint
    print("\n2. Testing /voices endpoint...")
    try:
        response = requests.get(f"{service_url}/voices", timeout=5)
        print(f"   Status: {response.status_code}")
        voices_data = response.json()
        print(f"   Available voices: {list(voices_data['voices'].keys())}")
        print("   ✅ Voices endpoint works!")
    except Exception as e:
        print(f"   ❌ Voices endpoint failed: {e}")
        return False
    
    # Test generate endpoint with English voice
    print("\n3. Testing /generate endpoint with Charlotte (English)...")
    try:
        test_data = {
            "text": "Hello, this is a test",
            "voice": "Charlotte"
        }
        response = requests.post(
            f"{service_url}/generate", 
            json=test_data, 
            timeout=30,
            headers={"Content-Type": "application/json"}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Content-Type: {response.headers.get('Content-Type')}")
            print(f"   Content-Length: {len(response.content)} bytes")
            print("   ✅ English generation works!")
        else:
            print(f"   ❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ English generation failed: {e}")
        return False
    
    # Test generate endpoint with Portuguese voice
    print("\n4. Testing /generate endpoint with Paulo (Portuguese)...")
    try:
        test_data = {
            "text": "Olá, este é um teste",
            "voice": "Paulo"
        }
        response = requests.post(
            f"{service_url}/generate", 
            json=test_data, 
            timeout=30,
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
    
    print("\n🎉 All tests passed! Hybrid TTS service is working correctly.")
    return True

if __name__ == "__main__":
    test_hybrid_service()
