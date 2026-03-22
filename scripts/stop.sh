#!/usr/bin/env bash
# scripts/stop.sh — Stop all ExamFlow services

echo "🛑 Stopping ExamFlow services..."
pkill -f "api/app.py"   2>/dev/null && echo "  ✓ ML service stopped"
pkill -f "src/app.js"   2>/dev/null && echo "  ✓ Backend stopped"
pkill -f "server.js"    2>/dev/null && echo "  ✓ WebSocket stopped"
pkill -f "vite"         2>/dev/null && echo "  ✓ Frontend stopped"
echo "Done."
