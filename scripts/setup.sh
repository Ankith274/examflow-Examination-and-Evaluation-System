#!/usr/bin/env bash
# scripts/setup.sh — First-time project setup

set -e
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ExamFlow — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env created — fill in your values"
fi

# Install frontend deps
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Install backend deps
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Install WebSocket deps
echo "📦 Installing websocket dependencies..."
cd websocket && npm install && cd ..

# Install ML deps
echo "🐍 Installing ML service dependencies..."
cd ml-service && pip install -r requirements.txt && cd ..

# Init DB
echo "🗄  Initialising database..."
psql "$DATABASE_URL" -f database/schema.sql 2>/dev/null || \
  echo "  ⚠  Skipping DB init (set DATABASE_URL to run manually)"

echo ""
echo "✅ Setup complete! Run:  bash scripts/start.sh"
