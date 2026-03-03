@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   AcademicFBI - Local Development Setup
echo ============================================
echo.

:: ── Check prerequisites ──────────────────────────

echo [1/5] Checking prerequisites...

:: Check Python 3.11
py -3.11 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Python 3.11 is required but not found.
    echo   Download: https://www.python.org/downloads/release/python-3119/
    echo   IMPORTANT: Check "Add Python to PATH" during install.
    echo   NOTE: Python 3.12+ has compatibility issues with this project.
    echo.
    exit /b 1
)
for /f "tokens=*" %%i in ('py -3.11 --version') do echo   [OK] %%i

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Node.js is required but not found.
    echo   Download: https://nodejs.org/
    echo.
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo   [OK] Node.js %%i
echo.

:: ── Backend setup ────────────────────────────────

echo [2/5] Setting up backend...
cd /d "%~dp0..\backend"

if not exist ".env" (
    echo.
    echo   ERROR: backend\.env file is missing!
    echo   Copy .env.example to backend\.env and fill in the values.
    echo   Ask a team member for the actual credentials.
    echo.
    exit /b 1
)
echo   [OK] .env file found

:: Create venv inside backend directory
if exist "venv" (
    echo   Removing old venv...
    rmdir /s /q venv
)

echo   Creating virtual environment (Python 3.11)...
py -3.11 -m venv venv
call venv\Scripts\activate.bat

echo   Upgrading pip...
python -m pip install --upgrade pip --quiet 2>nul

echo   Installing dependencies...
pip install -r requirements.txt --quiet 2>nul
if %errorlevel% neq 0 (
    echo   WARNING: Some packages may have failed. Retrying without --quiet...
    pip install -r requirements.txt
)
echo   [OK] Backend ready
echo.

:: ── Frontend setup ───────────────────────────────

echo [3/5] Setting up frontend...
cd /d "%~dp0..\frontend\my-app"

echo   Installing dependencies (this may take a minute)...
call npm install --silent 2>nul
echo   [OK] Frontend ready
echo.

:: ── Verify ───────────────────────────────────────

echo [4/5] Verifying setup...
cd /d "%~dp0..\backend"
call venv\Scripts\activate.bat

python -c "from src.main import app; print('  [OK] Backend imports verified')" 2>nul
if %errorlevel% neq 0 (
    echo   [WARN] Backend import failed. Check your .env file and dependencies.
)

:: Quick DB connectivity check
python -c "import asyncio; from src.config.database import connect_db; asyncio.run(connect_db()); print('  [OK] Database connection verified')" 2>nul
if %errorlevel% neq 0 (
    echo   [WARN] Database connection failed. Check MONGODB_URI in .env
)
echo.

:: ── Done ─────────────────────────────────────────

echo [5/5] Setup complete!
echo.
echo ============================================
echo   How to run
echo ============================================
echo.
echo   Backend (Terminal 1):
echo     cd backend
echo     venv\Scripts\activate
echo     python -m uvicorn src.main:app --reload --host 0.0.0.0
echo.
echo   Frontend (Terminal 2):
echo     cd frontend\my-app
echo     npm run dev
echo.
echo   Open http://localhost:3000 in your browser.
echo.
echo ============================================
echo   Troubleshooting
echo ============================================
echo.
echo   * "localhost" not working?
echo     Use --host 0.0.0.0 when starting backend (included above).
echo     Or set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 in
echo     frontend/my-app/.env.local
echo.
echo   * Port already in use?
echo     Use a different port: --port 8001
echo     Then set NEXT_PUBLIC_API_URL=http://localhost:8001 in
echo     frontend/my-app/.env.local
echo.
echo   * CORS errors?
echo     Make sure your frontend port (3000 or 3001) is listed in
echo     backend/src/main.py allow_origins.
echo.
echo   * Python 3.12/3.13 errors?
echo     This project requires Python 3.11. Install it and re-run setup.
echo.

endlocal
