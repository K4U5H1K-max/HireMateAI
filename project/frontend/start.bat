@echo off
echo ======================================
echo   HireMate AI - Startup Script
echo ======================================
echo.

if not exist backendmp.py (
    echo ERROR: backendmp.py not found in project folder!
    pause
    exit /b 1
)

if not exist .env (
    echo WARNING: .env not found. Copy .env.example to .env and set GEMINI_API_KEY.
    echo.
)

echo Starting Backend Server...
start "HireMate Backend" python backendmp.py

timeout /t 3 /nobreak > nul

echo Starting Frontend Dev Server...
start "HireMate Frontend" npm run dev

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause
