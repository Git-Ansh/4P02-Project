#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  AcademicFBI - Local Development Setup"
echo "============================================"
echo ""

# ── Check prerequisites ──────────────────────────

echo "[1/5] Checking prerequisites..."

# Check Python 3.11
if command -v python3.11 &>/dev/null; then
    PY=python3.11
elif command -v python3 &>/dev/null && python3 -c "import sys; assert sys.version_info[:2]==(3,11)" 2>/dev/null; then
    PY=python3
else
    echo ""
    echo "  ERROR: Python 3.11 is required but not found."
    echo "  Install it via:"
    echo "    macOS:  brew install python@3.11"
    echo "    Ubuntu: sudo apt install python3.11 python3.11-venv"
    echo "  NOTE: Python 3.12+ has compatibility issues with this project."
    echo ""
    exit 1
fi
echo "  [OK] $($PY --version)"

# Check Node.js
if ! command -v node &>/dev/null; then
    echo ""
    echo "  ERROR: Node.js is required but not found."
    echo "  Install it from: https://nodejs.org/"
    echo ""
    exit 1
fi
echo "  [OK] Node.js $(node --version)"
echo ""

# ── Backend setup ────────────────────────────────

echo "[2/5] Setting up backend..."
cd "$ROOT_DIR/backend"

if [ ! -f ".env" ]; then
    echo ""
    echo "  ERROR: backend/.env file is missing!"
    echo "  Copy .env.example to backend/.env and fill in the values."
    echo "  Ask a team member for the actual credentials."
    echo ""
    exit 1
fi
echo "  [OK] .env file found"

if [ -d "venv" ]; then
    echo "  Removing old venv..."
    rm -rf venv
fi

echo "  Creating virtual environment (Python 3.11)..."
$PY -m venv venv
source venv/bin/activate

echo "  Upgrading pip..."
pip install --upgrade pip --quiet 2>/dev/null

echo "  Installing dependencies..."
if ! pip install -r requirements.txt --quiet 2>/dev/null; then
    echo "  WARNING: Some packages may have failed. Retrying without --quiet..."
    pip install -r requirements.txt
fi
echo "  [OK] Backend ready"
echo ""

# ── Frontend setup ───────────────────────────────

echo "[3/5] Setting up frontend..."
cd "$ROOT_DIR/frontend/my-app"

echo "  Installing dependencies (this may take a minute)..."
npm install --silent 2>/dev/null
echo "  [OK] Frontend ready"
echo ""

# ── Verify ───────────────────────────────────────

echo "[4/5] Verifying setup..."
cd "$ROOT_DIR/backend"
source venv/bin/activate

if python -c "from src.main import app; print('  [OK] Backend imports verified')" 2>/dev/null; then
    :
else
    echo "  [WARN] Backend import failed. Check your .env file and dependencies."
fi

# Quick DB connectivity check
if python -c "import asyncio; from src.config.database import connect_db; asyncio.run(connect_db()); print('  [OK] Database connection verified')" 2>/dev/null; then
    :
else
    echo "  [WARN] Database connection failed. Check MONGODB_URI in .env"
fi
echo ""

# ── Done ─────────────────────────────────────────

echo "[5/5] Setup complete!"
echo ""
echo "============================================"
echo "  How to run"
echo "============================================"
echo ""
echo "  Backend (Terminal 1):"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    python -m uvicorn src.main:app --reload --host 0.0.0.0"
echo ""
echo "  Frontend (Terminal 2):"
echo "    cd frontend/my-app"
echo "    npm run dev"
echo ""
echo "  Open http://localhost:3000 in your browser."
echo ""
echo "============================================"
echo "  Troubleshooting"
echo "============================================"
echo ""
echo "  * \"localhost\" not working?"
echo "    Use --host 0.0.0.0 when starting backend (included above)."
echo "    Or set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 in"
echo "    frontend/my-app/.env.local"
echo ""
echo "  * Port already in use?"
echo "    Use a different port: --port 8001"
echo "    Then set NEXT_PUBLIC_API_URL=http://localhost:8001 in"
echo "    frontend/my-app/.env.local"
echo ""
echo "  * CORS errors?"
echo "    Make sure your frontend port (3000 or 3001) is listed in"
echo "    backend/src/main.py allow_origins."
echo ""
echo "  * Python 3.12/3.13 errors?"
echo "    This project requires Python 3.11. Install it and re-run setup."
echo ""
