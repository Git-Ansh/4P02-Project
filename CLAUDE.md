# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodeIntegrity** is a web-based plagiarism detection system for academic code submissions (C, C++, Java). It analyzes source code for similarities using a custom-built comparison engine (no external AI). Built for COSC 4P02 at Brock University.

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (in `frontend/my-app/`)
- **Backend:** Python 3.10+ + FastAPI + SQLAlchemy + PostgreSQL + Redis (in `backend/`)
- **Analysis Engine:** Tree-sitter based tokenizer, k-gram fingerprinting, Jaccard similarity comparison
- **Infrastructure:** Docker Compose, GitHub Actions CI/CD deploying to VPS via SSH

## Commands

### Frontend (`frontend/my-app/`)

```bash
npm run dev              # Dev server on :3000
npm run build            # Production build
npm run lint             # ESLint
npx tsc --noEmit         # TypeScript type-check
npx shadcn add <name>    # Add shadcn/ui component
```

### Backend (`backend/`)

```bash
# Setup
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run
uvicorn src.main:app --reload

# Test
pytest                              # All tests
pytest tests/test_specific.py       # Single file
pytest -k test_function_name        # Single test by name

# Code quality
black src/ tests/                   # Format
flake8 src/ tests/                  # Lint
isort src/ tests/                   # Sort imports

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Full Stack (Docker)

```bash
docker-compose up --build
```

## Architecture

### Frontend

Uses Next.js App Router (`app/` directory). The `@/` path alias maps to the `frontend/my-app/` root.

- `app/page.tsx` - Homepage with hero, features, role selection dialog
- `components/ui/` - shadcn/ui primitives (Radix UI + Tailwind)
- `components/` - Custom components (header, footer, hero-section, etc.)
- `lib/utils.ts` - `cn()` utility for Tailwind class merging
- Theme: dark by default via `next-themes`, Geist font family

### Backend

- `src/api/` - FastAPI route handlers
- `src/analysis/` - Core plagiarism detection engine
  - `tokenizer/` - Language-specific parsers (tree-sitter based)
  - `comparator/` - Similarity algorithms (k-gram + Jaccard)
  - `fingerprint/` - Code fingerprinting (winnowing, n-gram, AST)
- `src/models/` - SQLAlchemy database models
- `src/services/` - Business logic layer
- `src/config/` - Configuration (pydantic-settings)
- `backend/side.py` - Standalone prototype of the tokenizer/comparator pipeline

### Analysis Pipeline

1. Parse source code into AST via tree-sitter
2. Normalize AST nodes into abstract tokens (ID, NUM, STR, FUNC_DEF, LOOP_START, etc.)
3. Generate k-grams from token sequences
4. Compare k-gram multisets using Jaccard similarity

## Code Conventions

### TypeScript/React

- `import * as React from "react"` (not default import)
- Use `@/` alias for project imports
- Function declarations for components (not arrow functions)
- `cn()` for Tailwind class merging; `cva` for component variants
- 2-space indentation, semicolons, single quotes

### Python

- Black formatter (88 char line length), isort for imports
- Type hints on all function signatures
- Pydantic models for API request/response schemas
- FastAPI's `HTTPException` for API errors
- Google-style docstrings (Args/Returns sections)

## Environment

Copy `.env.example` to `.env`. Frontend env vars must be prefixed with `NEXT_PUBLIC_`. Key settings: `DATABASE_URL`, `REDIS_URL`, `SIMILARITY_THRESHOLD` (default 0.7), `ALLOWED_EXTENSIONS` (.c, .cpp, .cc, .h, .hpp, .java), `MAX_UPLOAD_SIZE` (10MB).

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs backend pytest on push/PR to `main`. On push to `main`, auto-deploys to VPS via SSH + docker-compose.

## Important Constraints

- The analysis engine must NOT use external AI services (project requirement)
- Student submissions must be anonymized before processing (FIPPA compliance)
- Branching: feature branches off `main` (`feature/amazing-feature` pattern)
