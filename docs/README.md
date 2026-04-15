# Project Binder — Academic FBI

**Academic Integrity Enforcement Platform**
COSC 4P02 · Brock University · Group 20 · Winter 2026

---

## Project Overview

Academic FBI is a web-based source-code plagiarism detection platform for academic institutions. Instructors upload student code submissions, run a multi-stage similarity analysis engine, and review flagged pairs in an anonymised side-by-side diff viewer. Student identities are encrypted at rest and revealed only through an admin-approved process.

**Built by:** Group 20  
**Course:** COSC 4P02 — Software Engineering II  
**Institution:** Brock University  
**Term:** Winter 2026

---

## Technology at a Glance

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Backend | Python 3.11 · FastAPI · Uvicorn |
| Database | MongoDB Atlas (cloud-hosted) |
| File storage | Fernet-encrypted files on OVH VPS |
| Analysis engine | Tree-sitter AST · k-gram fingerprinting · Moss winnowing · IDF-weighted Jaccard |
| Hosting | Frontend → Vercel · Backend → OVH VPS (Docker) |

---

## Document Index

### Setup & Deployment

| Document | Description |
|---|---|
| [Installation Manual](installation-manual/README.md) | Step-by-step local setup, production deployment, environment variables, first-time configuration |

### Technical Reference

| Document | Description |
|---|---|
| [Technical Specification](technical-manual/README.md) | Full tech stack, project structure, module reference, MongoDB schema, all API endpoints, analysis engine deep-dive, security model, data flow diagrams |
| [Maintenance Manual](technical-manual/maintenance.md) | Routine maintenance schedule, course expiry operations, log locations, deployment procedures, issue resolution runbook, backup & recovery |
| [Architecture Overview](architecture/README.md) | High-level system architecture diagram and component relationships |
| [API Reference](api/README.md) | Condensed API endpoint listing |

### User Documentation

| Document | Description |
|---|---|
| [User Manual](user-guide/README.md) | Role-by-role guide for Super Admin, University Admin, Instructor, and Student |

---

## Quick Links

- **Live platform:** deployed on Vercel (frontend) + OVH VPS (backend)
- **Local setup:** run `scripts\setup.bat` (Windows) or `bash scripts/setup.sh` (macOS/Linux)
- **API docs (local):** http://localhost:8000/docs
- **Health check (local):** http://localhost:8000/health

---

## Role Summary

| Role | Entry point | Key capability |
|---|---|---|
| Super Admin | `/super-admin` | Create universities and university admins |
| University Admin | `/admin` | Create instructors; approve identity reveals |
| Instructor | `/instructor` | Manage courses, assignments, submissions; run analysis |
| Student | `/submit/<token>` | Submit code — no account required |

---

## Key Features

- **Multi-stage plagiarism detection** — AST normalisation → k-gram fingerprinting → Moss winnowing → IDF-weighted Jaccard scoring
- **Boilerplate exclusion** — instructor-provided template code is fingerprinted and subtracted before scoring
- **Reference repositories** — previous offering submissions can be included for cross-cohort comparison
- **Full anonymisation** — students appear as "Student A / B / …" in all analysis views; real identity requires admin approval
- **At-rest encryption** — all student PII and submission files encrypted with Fernet (AES-128-CBC + HMAC-SHA256)
- **Course expiry & data retention** — mandatory end date per course; 30-day grace period for downloads; automatic data deletion after grace period
- **Multi-institution** — each university has its own isolated database (`uni_{slug}`) and admin hierarchy

---

