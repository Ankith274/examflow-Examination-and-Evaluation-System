#!/usr/bin/env bash
# scripts/start.sh — Start all services (dev mode)

set -e
echo "🚀 Starting ExamFlow services..."

# Start PostgreSQL (if local)
# pg_ctl start -D /usr/local/var/postgresql@15

# ML service
echo "🤖 Starting ML service (port 6000)..."
cd ml-service && python api/app.py &
ML_PID=$!
cd ..

# Backend API
echo "🔧 Starting Backend API (port 5000)..."
cd backend && npm run dev &
API_PID=$!
cd ..

# WebSocket server
echo "🔌 Starting WebSocket server (port 5001)..."
cd websocket && node server.js &
WS_PID=$!
cd ..

# Frontend
echo "🌐 Starting Frontend (port 3000)..."
cd frontend && npm run dev &
FE_PID=$!
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All services running"
echo "  Frontend  → http://localhost:3000"
echo "  API       → http://localhost:5000/api"
echo "  WebSocket → ws://localhost:5001"
echo "  ML        → http://localhost:6000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Press Ctrl+C to stop all services"

# Wait & cleanup on exit
trap "kill $ML_PID $API_PID $WS_PID $FE_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
