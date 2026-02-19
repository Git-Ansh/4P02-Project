# Academic FBI — Academic Integrity Submission and Similarity Analysis System

A web-based source-code similarity analysis platform for academic integrity. Instructors upload student code submissions and compare them — against each other and against historical repositories — to identify potential plagiarism. The system supports C, C++, and Java, uses a custom-built analysis engine (no external AI services), and anonymizes all student data to comply with FIPPA.

## Team

COSC 4P02 — Software Engineering II, Brock University, Winter 2026 — Group 20

| Name | Role |
|------|------|
| Darsh Kurmi | Team Leader |
| Riya Shah | Team member (Frontend) |
| Rishi Modi | Team member (Backend) |
| Rimon Paul | Team member (Backend) |
| Ansh Shah | Team member (Full Stack) |
| Manu Saini | Team member (Backend) |
| Paril Gabani | Team member (Backend) |

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Select institution, verify assignment key, upload code submissions, resubmit before deadline |
| **Instructor** | Manage courses/assignments, manage comparison repositories, run similarity analysis, view/export reports, compare flagged submissions side-by-side |
| **Administrator** | Manage instructor accounts and courses, configure global system settings, view activity logs |

## Features

- **Multi-language support** — C, C++, and Java
- **Repository management** — Compare against current-class submissions, previous offerings, or custom instructor-uploaded repositories
- **Similarity analysis engine** — Custom in-house pipeline (no external AI); see [Analysis Pipeline](#analysis-pipeline) below
- **Anonymization** — Tokenized identifiers replace student names throughout analysis and reports
- **Side-by-side comparison** — Highlighted diff view of flagged submission pairs
- **Batch analysis** — Process entire assignment submission sets at once
- **Export & download** — PDF/CSV reports and raw submission downloads
- **Role-based access control** — Separate permissions for Students, Instructors, and Administrators

## Architecture

The system follows a **4-layer architecture** (SRS Section 8.4):

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **UI Layer** | Next.js 16 + React 19 | Frontend SPA — dashboard, upload, reports, admin views |
| **Server Layer** | FastAPI (Python) | REST API — authentication, RBAC, business logic, job orchestration |
| **Data Layer** | PostgreSQL + file storage | Relational data (users, courses, results) and raw submission files |
| **Computation Layer** | Background workers | Similarity analysis pipeline — parsing, fingerprinting, comparison |

## Analysis Pipeline

Submissions flow through a 7-stage pipeline (SRS Section 8.5):

1. **Input** — Receive uploaded source files
2. **Parsing** — Language-specific lexing / AST extraction
3. **Normalization** — Strip comments, normalize identifiers and whitespace
4. **Feature Extraction** — Extract structural and syntactic features
5. **Fingerprinting** — Generate hash fingerprints (winnowing / n-gram)
6. **Similarity Measurement** — Compare fingerprint sets across submissions and repositories
7. **Result Aggregation** — Produce per-pair similarity scores and flag threshold violations

> **Note:** The comparison engine is developed entirely in-house. No external AI services are used for code comparison.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.10+ / FastAPI |
| Frontend | Next.js 16 / React 19 / TypeScript |
| Database | PostgreSQL 14+ |
| Cache | Redis |
| Containerization | Docker / Docker Compose |
| Hosting | OVH VPS |
| CI/CD | GitHub Actions |

## Project Structure

```
4P02-Project/
├── backend/                     # FastAPI backend
│   ├── src/
│   │   ├── api/                 # REST API endpoints
│   │   ├── analysis/            # Similarity analysis engine
│   │   │   ├── tokenizer/       # Language-specific tokenizers
│   │   │   ├── comparator/      # Similarity comparison algorithms
│   │   │   └── fingerprint/     # Code fingerprinting utilities
│   │   ├── models/              # Database models
│   │   ├── services/            # Business logic
│   │   ├── utils/               # Helper utilities
│   │   └── config/              # Configuration
│   ├── tests/                   # Backend tests
│   └── requirements.txt
│
├── frontend/
│   └── my-app/                  # Next.js frontend
│       ├── app/                 # App router pages
│       ├── components/          # UI components
│       ├── lib/                 # Utilities
│       ├── public/              # Static assets
│       └── package.json
│
├── database/                    # Database schemas and migrations
│   ├── migrations/
│   └── seeds/
│
├── repositories/                # Stored code repositories for comparison
│
├── docs/                        # Documentation
│   ├── api/                     # API reference
│   ├── architecture/            # Architecture overview
│   └── user-guide/              # User documentation
│
├── scripts/                     # Utility scripts
├── .github/workflows/           # CI/CD pipeline
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Git-Ansh/4P02-Project.git
   cd 4P02-Project
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   cd frontend/my-app
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run the application**
   ```bash
   # Backend
   cd backend
   uvicorn src.main:app --reload

   # Frontend (separate terminal)
   cd frontend/my-app
   npm run dev
   ```

### Using Docker

```bash
docker-compose up --build
```

## Privacy & Security

- **Anonymization** — Student names are replaced with tokenized identifiers before analysis
- **No code execution** — Uploaded code is never executed; only static analysis is performed
- **Malware scanning** — Submissions are scanned before processing
- **RBAC** — Role-based access control restricts data visibility per role
- **Encryption** — PII is encrypted at rest
- **FIPPA-compliant** — Data handling follows applicable Canadian privacy regulations

## API Documentation

API documentation is auto-generated by FastAPI and available at `/docs` (Swagger UI) or `/redoc` when the server is running. See also [docs/api](docs/api).

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend/my-app
npm test
```

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

This project is developed for academic purposes as part of COSC 4P02 at Brock University and must be deployed in compliance with applicable privacy regulations.
