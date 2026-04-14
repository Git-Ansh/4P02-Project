# Installation Manual

**Academic FBI — Academic Integrity Enforcement Platform**
COSC 4P02 · Brock University · Group 20 · Winter 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [System Requirements](#3-system-requirements)
4. [Prerequisites](#4-prerequisites)
5. [Local Installation](#5-local-installation)
6. [Environment Configuration Reference](#6-environment-configuration-reference)
7. [Production Deployment](#7-production-deployment)
8. [Verification](#8-verification)
9. [First-Time Setup](#9-first-time-setup)

---

## 1. System Overview

Academic FBI is a web-based source-code plagiarism detection platform for academic institutions. It allows instructors to upload student code submissions, run a multi-stage similarity analysis engine, and review flagged pairs in an anonymised side-by-side diff viewer.

**Key capabilities:**
- Supports Java, C, and C++ source files
- Encrypts all student submissions and identity data at rest
- Fully anonymises analysis results — real names require admin-approved reveal
- Comparison repositories (previous offerings, reference code) can be included in analysis
- Boilerplate exclusion prevents instructor-provided starter code from inflating scores

---

## 2. Architecture

The system is composed of three runtime layers, all containerised with Docker and orchestrated via Docker Compose for production deployment.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                     FRONTEND LAYER                           │
│  Next.js 14 (App Router) · TypeScript · Tailwind CSS        │
│  Hosted on Vercel (production) / localhost:3000 (dev)        │
│                                                              │
│  Pages:                                                      │
│    /submit/*          Student submission portal (public)     │
│    /instructor/*      Instructor dashboard                   │
│    /admin/*           University admin panel                 │
│    /super-admin/*     Platform super-admin                   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON / HTTPS)
┌────────────────────────▼────────────────────────────────────┐
│                      BACKEND LAYER                           │
│  Python 3.11 · FastAPI · Uvicorn ASGI server                │
│  Hosted on OVH VPS (production) / localhost:8000 (dev)       │
│                                                              │
│  Modules:                                                    │
│    src/api/           Route handlers (auth, instructor,      │
│                       submission, admin, super-admin)        │
│    src/services/      Business logic, analysis orchestration │
│    src/services/      comparison_engine.py — analysis engine │
│    src/models/        Pydantic request/response schemas      │
│    src/config/        Settings, database connection          │
│    src/utils/         Encryption (Fernet), ZIP utilities     │
└───────────┬────────────────────────────────────────────────-┘
            │ Motor (async MongoDB driver)
┌───────────▼─────────────────────────────────────────────────┐
│                       DATA LAYER                             │
│  MongoDB Atlas (cloud-hosted)                                │
│                                                              │
│  Databases:                                                  │
│    academic_fbi       Global: users, universities            │
│    uni_{slug}         Per-university: courses, assignments,  │
│                       submissions, analysis results          │
│                                                              │
│  File Storage:                                               │
│    /opt/academic-fbi/uploads/   Encrypted submission files   │
│    (UPLOAD_DIR in .env)         on VPS disk                  │
└─────────────────────────────────────────────────────────────┘
```

### How the Components Are Stitched Together

| Connection | Mechanism |
|---|---|
| Browser → Frontend | Standard HTTPS; Next.js serves pages from Vercel CDN |
| Frontend → Backend | `fetch()` calls via `lib/api.ts`; all authenticated routes include `Authorization: Bearer <JWT>` header |
| Backend authentication | JWT HS256 tokens signed with `JWT_SECRET`; validated on every protected endpoint via `src/api/deps.py` |
| Backend → MongoDB | Motor (async driver); single shared connection pool opened at startup via FastAPI lifespan hook |
| File storage | Student submissions encrypted with Fernet (AES-128-CBC + HMAC-SHA256) and stored on VPS disk; path: `UPLOAD_DIR/{university_slug}/{course_id}/{assignment_id}/{submission_id}/` |
| Analysis engine | Runs in the same Python process as the API, dispatched in a background thread to avoid blocking the ASGI event loop; uses `ProcessPoolExecutor` internally for parallel fingerprint extraction |
| Email | Transactional email via Brevo API (primary) or SMTP (fallback); used for submission receipts and assignment token emails |

### Analysis Engine Pipeline

```
Student ZIPs
     │
     ▼
[1] Extract & Parse (Tree-sitter)
     │  AST → normalised token stream
     ▼
[2] Semantic Enrichment
     │  Inject high-signal semantic tokens (accumulators, API calls)
     ▼
[3] Adaptive K-gram Generation
     │  k = f(token_count);  diversity filter applied
     ▼
[4] Winnowing (Moss algorithm)
     │  Select minimum hash in sliding window
     ▼
[5] Boilerplate Subtraction
     │  Remove hashes matching instructor-provided template code
     ▼
[6] Inverted Index + IDF Weights
     │  hash → {student_ids};  rare hashes weighted higher
     ▼
[7] Candidate Pair Comparison (parallel)
     │  IDF-weighted Jaccard similarity per candidate pair
     ▼
[8] Block Merging + Confidence Assignment
     │  Contiguous line ranges → MatchBlocks (HIGH/MEDIUM/LOW/FILE)
     ▼
Flagged Pairs → stored in MongoDB → served to frontend
```

---

## 3. System Requirements

### Minimum (Development / Single Institution)

| Resource | Minimum |
|---|---|
| CPU | 2 cores |
| RAM | 4 GB |
| Disk | 10 GB free (grows with submission volume) |
| OS | Windows 10+, macOS 12+, Ubuntu 20.04+ |
| Network | Internet access (MongoDB Atlas, npm, pip) |

### Recommended (Production / Multi-Institution)

| Resource | Recommended |
|---|---|
| CPU | 4+ cores (more cores = faster parallel analysis) |
| RAM | 8 GB+ |
| Disk | 50 GB+ SSD (submissions stored encrypted on disk) |
| OS | Ubuntu 22.04 LTS (current production OS) |
| Network | Static IP; ports 80/443 open for HTTPS |

### Software Dependencies

| Software | Version | Purpose |
|---|---|---|
| Python | **3.11.x** (not 3.12+) | Backend runtime |
| Node.js | 18 LTS or later | Frontend build and dev server |
| npm | Bundled with Node.js | Frontend package management |
| Git | Any recent | Source code management |
| Docker | 24+ | Production containerisation |
| Docker Compose | v2+ | Multi-container orchestration |

> **Python version is critical.** Python 3.12+ has breaking changes in several async libraries (`motor`, `pydantic`) used by this project. Always use Python 3.11.

---

## 4. Prerequisites

### 4.1 Install Python 3.11

| Platform | Method |
|---|---|
| **Windows** | Download from https://www.python.org/downloads/release/python-3119/ — check **"Add Python to PATH"** during install |
| **macOS** | `brew install python@3.11` |
| **Ubuntu/Debian** | `sudo apt install python3.11 python3.11-venv python3.11-dev` |

Verify:
```bash
# Windows
py -3.11 --version

# macOS / Linux
python3.11 --version
# Expected: Python 3.11.x
```

### 4.2 Install Node.js (LTS)

Download from https://nodejs.org/ and install Node.js v18 or later.

Verify:
```bash
node --version   # v18.x.x or later
npm --version    # 9.x.x or later
```

### 4.3 MongoDB Atlas Account

The project uses MongoDB Atlas (cloud-hosted MongoDB). You need:
- A MongoDB Atlas account
- A cluster with a database user created
- Your server's IP address whitelisted in the cluster's Network Access settings
- The connection string (`mongodb+srv://...`) from the cluster's **Connect** dialog

For local development you can whitelist `0.0.0.0/0` (all IPs) temporarily.

### 4.4 Clone the Repository

```bash
git clone https://github.com/Git-Ansh/4P02-Project.git
cd 4P02-Project
```

---

## 5. Local Installation

### 5.1 Backend Setup

```bash
cd backend

# Create a virtual environment with Python 3.11
# Windows:
py -3.11 -m venv venv
venv\Scripts\activate

# macOS / Linux:
python3.11 -m venv venv
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt
```

Create the backend environment file:

```bash
# Copy and edit the template
cp .env.example .env   # if .env.example exists, otherwise create manually
```

See [Section 6](#6-environment-configuration-reference) for all required variables.

Start the backend server:

```bash
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now available at **http://localhost:8000**.
Interactive API docs (Swagger UI) are at **http://localhost:8000/docs**.

### 5.2 Frontend Setup

Open a second terminal:

```bash
cd frontend/my-app

# Install Node.js dependencies
npm install

# (Optional) Create a .env.local if your backend runs on a non-default port
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start the dev server
npm run dev
```

The frontend is now available at **http://localhost:3000**.

### 5.3 Using the Setup Script (Recommended)

The project includes setup scripts that automate steps 5.1 and 5.2:

```bash
# Windows
scripts\setup.bat

# macOS / Linux
bash scripts/setup.sh
```

The script will:
1. Verify Python 3.11 and Node.js are installed
2. Create the backend virtual environment
3. Install all backend and frontend dependencies
4. Verify that backend imports and the database connection work

---

## 6. Environment Configuration Reference

### 6.1 `backend/.env` (Required)

Create this file in the `backend/` directory. It must not be committed to version control.

```env
# ── MongoDB ────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>
DB_NAME=academic_fbi

# ── JWT Authentication ──────────────────────────────────────────────────────
# Generate a strong random secret: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=<64-character-hex-string>

# ── File Storage ─────────────────────────────────────────────────────────────
# Directory where encrypted student submissions are stored.
# Must exist and be writable by the process running the server.
UPLOAD_DIR=/opt/academic-fbi/uploads   # Linux production
# UPLOAD_DIR=C:/academic-fbi/uploads   # Windows development

# ── Email — Brevo (preferred) ────────────────────────────────────────────────
# Leave blank to disable email; emails are silently skipped when not configured.
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=AcademicFBI

# ── Email — SMTP Fallback ─────────────────────────────────────────────────────
# Used only when Brevo is not configured.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=AcademicFBI
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | **Yes** | MongoDB Atlas connection string |
| `DB_NAME` | No | Database name (default: `academic_fbi`) |
| `JWT_SECRET` | **Yes** | HMAC secret for signing JWTs — keep private |
| `UPLOAD_DIR` | No | Encrypted file storage path (default: `/opt/academic-fbi/uploads`) |
| `BREVO_API_KEY` | No | Brevo transactional email API key |
| `BREVO_FROM_EMAIL` | No | Sender email address for Brevo |
| `SMTP_HOST` | No | SMTP server hostname for fallback email |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |

### 6.2 `frontend/my-app/.env.local` (Optional)

Only needed if the backend runs on a port other than 8000.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 7. Production Deployment

The production environment runs on an **OVH VPS (Ubuntu 22.04)** with the frontend hosted on **Vercel**.

### 7.1 Frontend (Vercel)

1. Push changes to the `main` branch on GitHub.
2. Vercel automatically detects the Next.js app at `frontend/my-app/` and deploys it.
3. Set the environment variable `NEXT_PUBLIC_API_URL` in the Vercel project settings to point to the VPS backend URL.

### 7.2 Backend (VPS with Docker)

The backend runs inside Docker containers managed by Docker Compose.

**Initial setup on the VPS:**

```bash
# Clone the repository
git clone https://github.com/Git-Ansh/4P02-Project.git
cd 4P02-Project

# Create the environment file
nano backend/.env   # fill in all required variables

# Create the upload directory
sudo mkdir -p /opt/academic-fbi/uploads
sudo chown $USER:$USER /opt/academic-fbi/uploads

# Build and start containers
docker compose up -d --build
```

**Subsequent deployments:**

```bash
git pull origin main
docker compose up -d --build
```

**Docker Compose services:**

| Service | Description | Port |
|---|---|---|
| `backend` | FastAPI application (Uvicorn) | 8000 |

The Dockerfile is located at `backend/Dockerfile`. It uses Python 3.11 slim base image, installs dependencies from `requirements.txt`, and starts Uvicorn on port 8000.

### 7.3 CORS Configuration

The backend allows requests from:
- `https://4-p02-project*.vercel.app` (Vercel preview and production deployments)
- `http://localhost:3000` (local development)

To add additional origins, edit the `allow_origin_regex` in `backend/src/main.py`.

### 7.4 CI/CD

GitHub Actions pipelines run automatically on every push:
- **Test gate** — runs the full pytest suite before deployment
- **Deploy** — SSHs into the VPS and runs `docker compose up -d --build`

Pipeline configuration is in `.github/workflows/`.

---

## 8. Verification

After installation, run these checks to confirm everything is working:

### 8.1 Backend Health Check

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "database": "connected"}
```

### 8.2 Backend Tests

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
python -m pytest tests/ -v
# Expected: all tests pass (188 tests)
```

### 8.3 Frontend Build Check

```bash
cd frontend/my-app
npm run build
# Expected: no TypeScript or build errors
```

### 8.4 End-to-End Smoke Test

1. Visit **http://localhost:3000** — the landing page should load.
2. Navigate to **http://localhost:8000/docs** — the Swagger UI should list all routes.
3. Log in with the super-admin credentials (created in Section 9) — dashboard should load.

---

## 9. First-Time Setup

After a fresh installation, the database is empty. Complete these steps before the platform is usable.

### 9.1 Create the Super-Admin Account

Run the seed script from the `backend/` directory with the virtual environment activated:

```bash
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
python scripts/seed_super_admin.py
```

The script will prompt for an email and password and create the super-admin user in the `academic_fbi` database.

### 9.2 Create a University

Log in to the platform as super-admin and:
1. Go to **Super Admin** > **Universities** > **Create University**
2. Fill in the university name and slug (URL identifier, e.g. `brock-university`)
3. Optionally set a logo URL and primary colour

### 9.3 Create University Administrator

Still as super-admin:
1. Go to the newly created university's page
2. Click **Create Admin Account**
3. Fill in the admin's name, email, and a temporary password

### 9.4 Create Instructors

Log in as the university administrator:
1. Go to **Admin** > **Instructors** > **Create Instructor**
2. Fill in the instructor's details
3. The instructor can now log in and create courses and assignments

### 9.5 Upload Directory

Ensure `UPLOAD_DIR` exists and is writable before any submissions are accepted:

```bash
# Linux / macOS
mkdir -p /opt/academic-fbi/uploads
chmod 755 /opt/academic-fbi/uploads

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "C:\academic-fbi\uploads"
```

---

*End of Installation Manual*
