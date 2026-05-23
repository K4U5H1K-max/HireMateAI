#!/bin/bash

echo "======================================"
echo "  HireMate AI - Startup Script"
echo "======================================"
echo ""

if [ ! -f "backendmp.py" ]; then
    echo "backendmp.py not found in project folder!"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "WARNING: .env not found. Copy .env.example to .env and set GEMINI_API_KEY."
    echo ""
fi

echo "Starting Backend Server..."
python3 backendmp.py &
BACKEND_PID=$!

sleep 3

echo "Starting Frontend Dev Server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
