#!/bin/bash

echo "Starting all development servers..."

# Function to cleanup background processes
cleanup() {
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap CTRL+C and cleanup
trap cleanup SIGINT

# Start TTS service in background
echo "Starting Hybrid TTS service..."
(
    source 'c:/Users/user/OneDrive - Talegon Ltd/UDEMY Courses/7n8n/.venv/Scripts/activate'
    cd "c:/Users/user/OneDrive - Talegon Ltd/UDEMY Courses/7n8n/short-video-maker/scripts/tts"
    python hybrid_tts_service.py
) &

# Wait a moment for TTS service to start
sleep 3

# Start the main development servers
echo "Starting main development servers..."
npm run dev

# Keep script running
wait
