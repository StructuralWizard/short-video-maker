@echo off
setlocal enabledelayedexpansion

echo *** STARTING SHORT VIDEO MAKER - DEVELOPMENT MODE ***
echo ======================================================

:: Cleanup any existing processes first
echo Cleaning up any existing processes...
call stop-all.bat >nul 2>&1

:: Wait a moment for cleanup
timeout /t 2 /nobreak >nul

echo.
echo Starting all development servers...

:: Start Hybrid TTS service in a new terminal
echo 🗣️  Starting Hybrid TTS Service on port 5003...
start "Hybrid TTS Service" cmd /c "cd /d "c:\Users\user\OneDrive - Talegon Ltd\UDEMY Courses\7n8n\.venv\Scripts" && activate.bat && cd /d "c:\Users\user\OneDrive - Talegon Ltd\UDEMY Courses\7n8n\short-video-maker\scripts\tts" && python hybrid_tts_service.py"

:: Wait for TTS service to start
timeout /t 5 /nobreak >nul

:: Start the main development servers (backend + frontend)
echo 🖥️  Starting backend (port 3123) and frontend (port 3121)...
npm run dev

echo.
echo ⚠️  When you're done, run 'stop-all.bat' to cleanup all processes
echo.
pause
