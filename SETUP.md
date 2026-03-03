# AcademicFBI — Developer Setup Guide

Complete guide for new team members to set up the project locally and start contributing.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Environment Files](#3-environment-files)
4. [Run the Setup Script](#4-run-the-setup-script)
5. [Start the Application](#5-start-the-application)
6. [Git Workflow](#6-git-workflow)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Install these **before** running the setup script.

### Python 3.11 (Required — NOT 3.12 or 3.13)

Python 3.12+ has compatibility issues with `motor` and other async libraries used in this project. You **must** use Python 3.11.

| Platform | Install command |
|----------|----------------|
| **Windows** | Download from https://www.python.org/downloads/release/python-3119/ — **check "Add Python to PATH"** during install |
| **macOS** | `brew install python@3.11` |
| **Ubuntu/Debian** | `sudo apt install python3.11 python3.11-venv` |

Verify after install:
```bash
# Windows
py -3.11 --version

# macOS / Linux
python3.11 --version
```

### Node.js (LTS)

Download from https://nodejs.org/ (v18 or later).

```bash
node --version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/Git-Ansh/4P02-Project.git
cd 4P02-Project
```

---

## 3. Environment Files

Several files are **not tracked by git** (listed in `.gitignore`) and must be created manually. Ask a team member for the actual values.

### 3a. Backend `.env` (Required)

Create the file `backend/.env`. There is a template at `.env.example` in the repo root.

```bash
# Copy the template
cp .env.example backend/.env
```

Then fill in the actual values:

```env
# =========================
# MongoDB (Required)
# =========================
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>
DB_NAME=academic_fbi

# =========================
# JWT Authentication (Required)
# =========================
JWT_SECRET=<generate-a-random-256-bit-hex-string>

# =========================
# Brevo Email (Optional — emails skip if not set)
# =========================
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=AcademicFBI

# =========================
# SMTP Fallback (Optional — used only if Mailjet is not set)
# =========================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=AcademicFBI
```

> **Where to get the values:** Ask a team member (Ansh or Darsh) for the MongoDB URI, JWT secret, and email credentials. Do **not** commit this file.

### 3b. Frontend `.env.local` (Optional)

Only needed if your backend runs on a non-default port (default is `8000`).

Create `frontend/my-app/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Change the port if your backend uses a different one (e.g., `8001` if port `8000` is already in use).

> **How it works:** The frontend reads `NEXT_PUBLIC_API_URL` at build/dev time. If this file doesn't exist, it defaults to `http://localhost:8000` (set in `frontend/my-app/lib/api.ts`).

### Summary of files not in git

| File | Location | Required? | Purpose |
|------|----------|-----------|---------|
| `.env` | `backend/.env` | **Yes** | MongoDB, JWT, email credentials |
| `.env.local` | `frontend/my-app/.env.local` | No | Override backend API URL |

---

## 4. Run the Setup Script

The setup script automatically creates the Python virtual environment, installs all dependencies, and verifies everything works.

### Windows

```cmd
scripts\setup.bat
```

### macOS / Linux

```bash
bash scripts/setup.sh
```

The script will:
1. Verify Python 3.11 and Node.js are installed
2. Create a virtual environment in `backend/venv` using Python 3.11
3. Install all backend Python dependencies
4. Install all frontend Node.js dependencies
5. Verify backend imports and database connectivity

If you see `[OK]` for all checks, you're ready to go.

---

## 5. Start the Application

You need **two terminals** — one for the backend and one for the frontend.

### Terminal 1 — Backend

```bash
cd backend

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Start the server
python -m uvicorn src.main:app --reload --host 0.0.0.0
```

The backend runs at **http://localhost:8000**. API docs are at http://localhost:8000/docs.

### Terminal 2 — Frontend

```bash
cd frontend/my-app
npm run dev
```

The frontend runs at **http://localhost:3000**.

### Open in browser

Go to **http://localhost:3000**.

---

## 6. Git Workflow

### Golden rule: NEVER work directly on `main`

The `main` branch is the production branch. All changes go through feature branches and pull requests.

### Creating a feature branch

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create a new branch
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**

| Type | Format | Example |
|------|--------|---------|
| New feature | `feature/description` | `feature/student-enrollment` |
| Bug fix | `fix/description` | `fix/cors-error` |
| Refactor | `refactor/description` | `refactor/email-service` |
| Documentation | `docs/description` | `docs/setup-guide` |

### Making commits

```bash
git add <specific-files>
git commit -m "feat: add student enrollment endpoints"
```

Commit message prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `docs:` — documentation
- `chore:` — maintenance (deps, config, etc.)

### Pushing and creating a PR

```bash
# Push your branch to remote
git push origin feature/your-feature-name
```

Then go to GitHub and create a **Pull Request** targeting `main`:

1. Go to https://github.com/Git-Ansh/4P02-Project
2. You'll see a prompt to create a PR for your recently pushed branch
3. Click **"Compare & pull request"**
4. Write a clear title and description of your changes
5. Request a review from a team member
6. Once approved, merge the PR

Or use the GitHub CLI:
```bash
gh pr create --title "feat: add student enrollment" --body "Description of changes"
```

### Keeping your branch up to date

If `main` has been updated while you're working:

```bash
git checkout main
git pull origin main
git checkout feature/your-feature-name
git merge main
# Resolve any conflicts, then continue working
```

### After your PR is merged

```bash
git checkout main
git pull origin main
git branch -d feature/your-feature-name   # delete local branch
```

---

## 7. Troubleshooting

### "localhost" not working / ERR_EMPTY_RESPONSE

Your system might resolve `localhost` to IPv6 (`::1`) instead of `127.0.0.1`.

**Fix:** The backend start command already includes `--host 0.0.0.0` which binds to all interfaces. If it still fails, create `frontend/my-app/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### Port 8000 already in use

Another process is using port 8000. Either kill it or use a different port:

```bash
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8001
```

Then update `frontend/my-app/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### CORS errors in browser console

Your frontend port (3000 or 3001) may not be in the allowed origins list. Check `backend/src/main.py` — the `allow_origins` list should include your frontend URL. Currently allowed:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`

### Python 3.12 / 3.13 errors

You'll see errors like `ModuleNotFoundError` or `pydantic_core` build failures. **This project requires Python 3.11.** Uninstall the newer version (or keep it but install 3.11 alongside), then re-run the setup script.

### `ModuleNotFoundError: No module named 'motor'` (or any module)

Your virtual environment isn't activated or dependencies aren't installed.

```bash
# Windows
cd backend
venv\Scripts\activate
pip install -r requirements.txt

# macOS/Linux
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Database connection failed

- Check that `MONGODB_URI` in `backend/.env` is correct
- Make sure your IP is whitelisted in MongoDB Atlas (or set to `0.0.0.0/0` for dev)
- Test with: `python -c "import asyncio; from src.config.database import connect_db; asyncio.run(connect_db()); print('OK')"`

### Frontend starts on port 3001 instead of 3000

Port 3000 is already in use. Either kill the process using it or let the frontend run on 3001 — both ports are in the CORS allow list.

---

## Quick Reference

| What | Command |
|------|---------|
| Activate backend venv (Windows) | `cd backend && venv\Scripts\activate` |
| Activate backend venv (Mac/Linux) | `cd backend && source venv/bin/activate` |
| Start backend | `python -m uvicorn src.main:app --reload --host 0.0.0.0` |
| Start frontend | `cd frontend/my-app && npm run dev` |
| API docs | http://localhost:8000/docs |
| App | http://localhost:3000 |
| Create branch | `git checkout -b feature/name` |
| Push branch | `git push origin feature/name` |
| Create PR | `gh pr create` or use GitHub web UI |
