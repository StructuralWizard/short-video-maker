@echo off
echo Stopping all short-video-maker processes...

echo.
echo Killing processes on port 3123 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3123') do (
    echo Killing PID %%a
    taskkill /f /pid %%a 2>nul
)

echo.
echo Killing processes on port 3121 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3121') do (
    echo Killing PID %%a
    taskkill /f /pid %%a 2>nul
)

echo.
echo Killing processes on port 5003 (TTS Service)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5003') do (
    echo Killing PID %%a
    taskkill /f /pid %%a 2>nul
)

echo.
echo Killing Node.js processes...
taskkill /f /im "node.exe" 2>nul
taskkill /f /im "tsx.exe" 2>nul

echo.
echo Killing Python TTS processes...
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo table /nh ^| findstr hybrid_tts_service') do (
    echo Killing Python TTS PID %%a
    taskkill /f /pid %%a 2>nul
)

echo.
echo ✅ Cleanup complete! All processes stopped.
pause
