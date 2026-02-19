# System Architecture

Architecture overview for **Academic FBI** — the Academic Integrity Submission and Similarity Analysis System.

## 4-Layer Architecture

The system is organized into four layers:

### 1. UI Layer

- **Technology:** Next.js 16 / React 19 / TypeScript
- **Responsibility:** Single-page application serving all user-facing views — student upload portal, instructor dashboard, analysis reports, side-by-side diff viewer, and administrator panel.
- **Communication:** Calls the Server Layer via REST API (JSON over HTTPS).

### 2. Server Layer (Application)

- **Technology:** FastAPI (Python 3.10+)
- **Responsibility:** REST API gateway handling authentication, role-based access control, request validation, business logic, and job orchestration. Routes analysis requests to background workers.
- **Key modules:** `backend/src/api/`, `backend/src/services/`, `backend/src/models/`

### 3. Data Layer (Storage)

- **Technology:** PostgreSQL 14+ (relational data), file system / object storage (raw submissions)
- **Responsibility:** Persists users, courses, assignments, submissions metadata, analysis results, and configuration. Raw source files are stored on disk and referenced by the database.
- **Cache:** Redis is used for session management and job queue state.

### 4. Computation Layer (Background Analysis)

- **Technology:** Python workers consuming a task queue
- **Responsibility:** Runs the similarity analysis pipeline on submitted code. Operates asynchronously so analysis jobs do not block API responses.
- **Key modules:** `backend/src/analysis/` (tokenizer, comparator, fingerprint)

## Layer Interaction

```
┌──────────────────────────────┐
│        UI Layer              │
│   (Next.js / React 19)      │
└──────────┬───────────────────┘
           │  REST / HTTPS
┌──────────▼───────────────────┐
│      Server Layer            │
│   (FastAPI)                  │
└──────┬──────────┬────────────┘
       │          │  task queue
┌──────▼──────┐ ┌─▼────────────┐
│ Data Layer  │ │ Computation  │
│ (PostgreSQL │ │   Layer      │
│  + files)   │ │ (workers)    │
└─────────────┘ └──────────────┘
```

## Deployment

All layers are containerized with Docker Compose and deployed to an OVH VPS. GitHub Actions handles CI/CD — see `.github/workflows/deploy.yml`.
