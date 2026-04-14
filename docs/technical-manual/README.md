# Technical Specification & Source Code Documentation

**Academic FBI — Academic Integrity Enforcement Platform**
COSC 4P02 · Brock University · Group 20 · Winter 2026

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Backend — Module Reference](#3-backend--module-reference)
4. [Database Schema](#4-database-schema)
5. [API Endpoint Reference](#5-api-endpoint-reference)
6. [Analysis Engine — Technical Specification](#6-analysis-engine--technical-specification)
7. [Frontend — Module Reference](#7-frontend--module-reference)
8. [Security Model](#8-security-model)
9. [Data Flow Diagrams](#9-data-flow-diagrams)

---

## 1. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend framework | Next.js (App Router) | 14+ | Page routing, SSR, API proxying |
| Frontend language | TypeScript | 5+ | Type-safe component and lib code |
| UI components | shadcn/ui + Tailwind CSS | latest | Pre-built accessible components |
| Backend framework | FastAPI | 0.110+ | REST API, dependency injection, OpenAPI docs |
| Backend language | Python | **3.11.x** | Business logic, analysis engine |
| ASGI server | Uvicorn | 0.29+ | Production-grade async HTTP server |
| Database | MongoDB Atlas | 7+ | Document store for all persistent data |
| ODM / driver | Motor (async) | 3.3+ | Async MongoDB client for Python |
| Data validation | Pydantic v2 | 2.x | Request/response schema validation |
| Authentication | python-jose | 3.3+ | JWT token encoding/decoding |
| Password hashing | passlib + bcrypt | 1.7+ | Secure password storage |
| File encryption | cryptography (Fernet) | 41+ | AES-128-CBC at-rest encryption |
| AST parsing | Tree-sitter | 0.21+ | Language-specific AST generation |
| Fingerprinting | MurmurHash3 (mmh3) | 4+ | Fast non-cryptographic hashing |
| Email | Brevo API / SMTP | — | Transactional email delivery |
| Containerisation | Docker + Docker Compose | 24+ | Production deployment |
| CI/CD | GitHub Actions | — | Automated test and deploy pipeline |

---

## 2. Project Structure

```
4P02-Project/
├── backend/
│   ├── src/
│   │   ├── main.py                 Application entry point; lifespan, routers, CORS
│   │   ├── api/
│   │   │   ├── auth.py             Login, university theme (public)
│   │   │   ├── deps.py             JWT auth dependency, role enforcement
│   │   │   ├── instructor.py       Courses, assignments, submissions, analysis
│   │   │   ├── submission.py       Student submission portal (public)
│   │   │   ├── super_admin.py      Platform-wide admin (universities, admins)
│   │   │   └── university_admin.py Per-institution admin (instructors, reveal)
│   │   ├── config/
│   │   │   ├── settings.py         Pydantic settings (reads from .env)
│   │   │   └── database.py         Motor client singleton, DB accessors
│   │   ├── models/
│   │   │   └── schemas.py          All Pydantic request/response models
│   │   ├── services/
│   │   │   ├── analysis.py         Analysis orchestration (prep ZIPs, store results)
│   │   │   ├── auth.py             Password hashing, JWT creation/decoding
│   │   │   ├── comparison_engine.py Full plagiarism detection pipeline
│   │   │   ├── course_expiry.py    Daily background task — deletes data after grace period
│   │   │   └── email.py            Email dispatch (Brevo / SMTP)
│   │   └── utils/
│   │       ├── encryption.py       Fernet key derivation, encrypt/decrypt helpers
│   │       └── zip_utils.py        Recursive ZIP extraction, macOS cleanup
│   ├── scripts/
│   │   ├── seed_super_admin.py     One-time script to create the first super-admin
│   │   └── set_course_end_date.py  Admin utility — set/correct a course end_date in MongoDB
│   ├── tests/                      188 pytest test cases
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/my-app/
│   ├── app/                        Next.js App Router pages
│   │   ├── page.tsx                Landing page
│   │   ├── layout.tsx              Root layout (fonts, theme provider)
│   │   ├── middleware.ts            JWT cookie-based route protection
│   │   ├── instructor/             Instructor dashboard pages
│   │   │   └── courses/[id]/
│   │   │       └── assignments/[assignmentId]/
│   │   │           ├── analysis/   Analysis report + pair detail pages
│   │   │           └── submissions/ Submission list pages
│   │   ├── admin/                  University admin pages
│   │   ├── super-admin/            Super-admin pages
│   │   └── submit/                 Student submission portal
│   ├── components/
│   │   ├── analysis/               Analysis-specific UI components
│   │   │   ├── code-diff-viewer.tsx Side-by-side highlighted diff viewer
│   │   │   ├── block-navigator.tsx  Prev/Next block navigation control
│   │   │   ├── severity-badge.tsx   Confidence level pill/dot indicators
│   │   │   ├── pair-list-panel.tsx  Flagged pairs sidebar list
│   │   │   ├── pair-ranking-table.tsx Sortable pairs table
│   │   │   ├── analysis-stats-bar.tsx Summary stats header bar
│   │   │   ├── severity-donut.tsx   Confidence distribution donut chart
│   │   │   ├── stats-card.tsx       Single metric card
│   │   │   └── threshold-slider.tsx Similarity threshold filter slider
│   │   └── ui/                     shadcn/ui component library
│   ├── lib/
│   │   ├── api.ts                  HTTP client (apiFetch), ApiError
│   │   ├── auth.ts                 Login, logout, token decode, role routing
│   │   ├── utils.ts                cn() Tailwind class merge utility
│   │   ├── university-theme.ts     Theme fetch + CSS variable generation
│   │   └── types/
│   │       └── analysis.ts         TypeScript interfaces for engine output
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── docs/                           Project documentation
├── scripts/                        Dev setup scripts (setup.sh / setup.bat)
├── docker-compose.yml
└── .github/workflows/              CI/CD pipelines
```

---

## 3. Backend — Module Reference

### `src/main.py`
Application entry point. Responsibilities:
- Registers the FastAPI lifespan hook (`connect_db` on startup, `close_db` on shutdown).
- Mounts all API routers.
- Configures CORS to allow Vercel deployments and localhost.
- Exposes `GET /health` (liveness probe) and `GET /api/universities` (public institution list).

### `src/config/settings.py`
Single `Settings` class (Pydantic `BaseSettings`) that reads all configuration from environment variables or `.env`. The instance `settings` is imported directly where needed — no dependency injection required for config.

### `src/config/database.py`
Manages a module-level `AsyncIOMotorClient` singleton. Key functions:

| Function | Returns | Description |
|---|---|---|
| `connect_db()` | `None` | Create client, ping MongoDB to verify connectivity |
| `close_db()` | `None` | Close the connection pool |
| `get_client()` | `AsyncIOMotorClient` | Return the shared client (raises if not initialised) |
| `get_main_db()` | `AsyncIOMotorDatabase` | Global `academic_fbi` database |
| `get_university_db(slug)` | `AsyncIOMotorDatabase` | Per-university `uni_{slug}` database |

### `src/api/deps.py`
FastAPI dependency factories:

| Dependency | Role required | Returns |
|---|---|---|
| `get_current_user` | Any valid JWT | Decoded JWT payload dict |
| `require_role("instructor")` | `instructor` or higher | Decoded JWT payload dict |
| `require_role("university_admin")` | `university_admin` | Decoded JWT payload dict |
| `require_role("super_admin")` | `super_admin` | Decoded JWT payload dict |

### `src/services/auth.py`
Pure functions for credentials and tokens — no database access:

| Function | Description |
|---|---|
| `hash_password(password)` | bcrypt hash |
| `verify_password(plain, hashed)` | bcrypt verify |
| `create_access_token(data)` | Sign and return a JWT string |
| `decode_access_token(token)` | Verify and decode JWT; raises `JWTError` on failure |

### `src/services/course_expiry.py`
Background task that enforces the course data-retention policy.

**Policy:**
Every course has a mandatory `end_date` set at creation. Once that date passes, instructors enter a **30-day grace period** during which they can view and download submissions. After 30 days all submission files and MongoDB documents are permanently deleted; the course record itself is preserved for reference.

**Status lifecycle:**

| Status | Condition | UI indicator |
|---|---|---|
| *(none)* | `end_date` > 15 days away | No badge |
| `expiring_soon` | `end_date` in future, ≤ 15 days away | Yellow badge |
| `grace_period` | `end_date` passed, ≤ 30 days ago | Orange badge + download warning |
| `data_deleted` | `end_date` + 30 days passed | Red badge |

**Key functions:**
- `start_expiry_cleanup_task()` — schedules the asyncio background loop; called once from the FastAPI lifespan on startup.
- `_cleanup_expired_courses()` — iterates all university databases, finds courses past the grace cutoff, deletes disk files (`shutil.rmtree`), removes submission and analysis MongoDB documents, and stamps the course with `data_deleted: True`.
- All comparisons use **Toronto time** (`America/Toronto`) so expiry aligns with the academic calendar.

**`scripts/set_course_end_date.py`** — admin-only CLI tool to set or correct a course's `end_date` in MongoDB (bypasses the API lock). Usage:
```bash
python -m scripts.set_course_end_date --slug brock-university --code "COSC 4P02" --end-date 2026-04-30
```

### `src/services/analysis.py`
Orchestrates the analysis pipeline:
- `prepare_submission_zips(db, slug, course_id, assignment_id)` — fetches the latest submission per student, decrypts their files, and writes per-student ZIPs to a temp directory for the engine.
- `run_analysis_job(...)` — called in a background thread; invokes the engine, stores results in MongoDB, updates job status.

### `src/services/email.py`
Provider-agnostic email dispatch. Uses Brevo API if configured, otherwise SMTP. Both public functions silently catch exceptions so email failures never reach the API caller:
- `send_submission_receipt(...)` — sent to student after upload.
- `send_assignment_token_email(...)` — sent to student with submission link.

### `src/utils/encryption.py`
Fernet (AES-128-CBC + HMAC-SHA256) wrapper. The key is derived from `JWT_SECRET` via PBKDF2-HMAC-SHA256 so no separate encryption secret is required:
- `encrypt_bytes(data)` / `decrypt_bytes(data)` — binary.
- `encrypt_string(text)` / `decrypt_string(token)` — string.
- `make_submission_id(name, number, email)` — deterministic HMAC-SHA256 hex ID for a student.

### `src/utils/zip_utils.py`
- `extract_zip_recursive(zip_path, dest_dir)` — extract and recurse into nested ZIPs.
- `resolve_nested_zips(directory)` — walk a directory, extract any ZIPs found, recurse.
- `cleanup_macosx(directory)` — remove `__MACOSX/` directories and `._` prefixed files.

---

## 4. Database Schema

### Global Database: `academic_fbi`

#### Collection: `users`
```json
{
  "_id":         "ObjectId",
  "email":       "string",
  "password":    "string (bcrypt hash)",
  "full_name":   "string",
  "role":        "super_admin | university_admin | instructor",
  "university_slug": "string | null",
  "created_at":  "datetime"
}
```

#### Collection: `universities`
```json
{
  "_id":             "ObjectId",
  "name":            "string",
  "slug":            "string (unique, lowercase-hyphenated)",
  "domain":          "string | null",
  "logo_url":        "string | null",
  "primary_color":   "string | null (hex, e.g. #CC0000)",
  "secondary_color": "string | null (hex)",
  "status":          "active | inactive",
  "created_at":      "datetime"
}
```

---

### Per-University Database: `uni_{slug}`

#### Collection: `courses`
```json
{
  "_id":              "ObjectId",
  "code":             "string (e.g. COSC 4P02)",
  "title":            "string",
  "term":             "string — auto-computed from end_date (e.g. Winter 2026, Fall/Winter 2025-2026)",
  "description":      "string | null",
  "instructor_email": "string",
  "instructor_name":  "string",
  "created_at":       "datetime",
  "end_date":         "datetime — noon Toronto time on the chosen calendar date; mandatory; immutable after creation",
  "data_deleted":     "boolean | null — true once the 30-day grace period has elapsed and data has been purged",
  "data_deleted_at":  "datetime | null — timestamp when the cleanup ran"
}
```

> **Term auto-computation:** The `term` field is derived from `end_date` and `created_at` at creation time and never recalculated. Month-to-term mapping: Jan–Apr → Winter, May–Jul → Summer, Aug–Dec → Fall. If the course spans two terms, both are shown (e.g. `Fall/Winter 2025-2026`).

> **End date immutability:** Instructors cannot change `end_date` via the API after creation. To correct an end date, an admin must escalate to the Academic FBI help center, who can run `scripts/set_course_end_date.py` directly against MongoDB.

#### Collection: `assignments`
```json
{
  "_id":               "ObjectId",
  "course_id":         "ObjectId",
  "title":             "string",
  "description":       "string | null",
  "due_date":          "datetime | null",
  "max_score":         "float",
  "allow_resubmission":"boolean",
  "language":          "java | c | cpp",
  "created_at":        "datetime"
}
```

#### Collection: `submissions`
```json
{
  "_id":            "ObjectId",
  "assignment_id":  "ObjectId",
  "course_id":      "ObjectId",
  "student_name":   "string (Fernet-encrypted)",
  "student_email":  "string (Fernet-encrypted)",
  "student_number": "string (plaintext — used as folder key)",
  "submission_id":  "string (HMAC-derived — used as encrypted folder name)",
  "language":       "string",
  "comment":        "string | null",
  "files":          [{"name": "string", "size": "int"}],
  "submitted_at":   "datetime"
}
```

> Student name and email are stored encrypted. Only the university admin (after approving a reveal request) can decrypt them. `submission_id` is a deterministic HMAC-SHA256 hex digest of `student_number:name:email` — the same student always gets the same ID for a given server secret.

#### Collection: `analysis_runs`
```json
{
  "_id":          "ObjectId",
  "assignment_id":"ObjectId",
  "course_id":    "ObjectId",
  "status":       "running | completed | failed",
  "started_at":   "datetime",
  "completed_at": "datetime | null",
  "error":        "string | null",
  "metadata": {
    "total_students":              "int",
    "total_pairs_possible":        "int",
    "candidate_pairs_evaluated":   "int",
    "pairs_flagged":               "int",
    "similarity_threshold":        "float",
    "boilerplate_hashes_filtered": "int"
  },
  "pairs": [ "...see MatchBlock schema below..." ]
}
```

#### Analysis Pair Schema (embedded in `analysis_runs.pairs`)
```json
{
  "pair_id":        "string (UUID)",
  "student_1":      "string (anonymous label, e.g. Student A)",
  "student_2":      "string (anonymous label, e.g. Student B)",
  "similarity":     "float (0–1, IDF-weighted Jaccard)",
  "severity_score": "float (0–1, composite)",
  "summary": {
    "total_blocks":               "int",
    "high_confidence_blocks":     "int",
    "total_suspicious_lines_a":   "int",
    "total_suspicious_lines_b":   "int",
    "average_density":            "float"
  },
  "blocks": [
    {
      "block_id":       "int",
      "file_a":         "string (relative file path, student_1 side)",
      "file_b":         "string (relative file path, student_2 side)",
      "start_a":        "int (1-based line number)",
      "end_a":          "int",
      "start_b":        "int",
      "end_b":          "int",
      "block_length":   "int",
      "density":        "float (0–1)",
      "confidence":     "HIGH | MEDIUM | LOW | FILE"
    }
  ],
  "files": {
    "<student_id>": {
      "<filename>": [{"block_id": "int", "start": "int", "end": "int"}]
    }
  },
  "sources": {
    "<student_id>": {"<filename>": "string (source code text)"}
  }
}
```

#### Collection: `reveal_requests`
```json
{
  "_id":           "ObjectId",
  "pair_id":       "string",
  "assignment_id": "ObjectId",
  "course_id":     "ObjectId",
  "instructor_id": "string",
  "justification": "string",
  "status":        "pending | approved | denied",
  "requested_at":  "datetime",
  "resolved_at":   "datetime | null"
}
```

#### Collection: `references`
```json
{
  "_id":          "ObjectId",
  "assignment_id":"ObjectId",
  "course_id":    "ObjectId",
  "filename":     "string",
  "student_count":"int",
  "uploaded_at":  "datetime"
}
```

---

## 5. API Endpoint Reference

All authenticated endpoints require `Authorization: Bearer <token>` in the request header.

### Auth — `/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Email + password → JWT token |
| `GET` | `/api/universities` | None | List all active universities |
| `GET` | `/api/universities/{slug}/theme` | None | Get university branding (logo, colours) |

**Login request body:**
```json
{ "email": "user@example.com", "password": "...", "university_slug": "brock-university" }
```
**Login response:**
```json
{ "access_token": "...", "token_type": "bearer", "role": "instructor", "university_slug": "brock-university" }
```

---

### Public Submission — `/api/public`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/public/assignment?token=...` | Assignment JWT | Decode token → assignment metadata |
| `POST` | `/api/public/submit` | Assignment JWT (in body) | Upload student files |

---

### Instructor — `/api/instructor`

**Role required:** `instructor` or `university_admin`

#### Dashboard
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instructor/dashboard` | Course count, submission counts, recent analyses, flagged pairs |
| `GET` | `/api/instructor/analysis/recent` | Recent analysis runs across all courses |

#### Courses
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instructor/courses` | List instructor's courses (includes `expiry_status`) |
| `POST` | `/api/instructor/courses` | Create a course — `end_date` required; `term` auto-computed |
| `GET` | `/api/instructor/courses/{id}` | Get course details |
| `PATCH` | `/api/instructor/courses/{id}` | Update course — `end_date` and `term` are immutable |
| `DELETE` | `/api/instructor/courses/{id}` | Delete course |

#### Assignments
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instructor/courses/{id}/assignments` | List assignments |
| `POST` | `/api/instructor/courses/{id}/assignments` | Create assignment |
| `PATCH` | `/api/instructor/courses/{id}/assignments/{aId}` | Update assignment |
| `DELETE` | `/api/instructor/courses/{id}/assignments/{aId}` | Delete assignment |
| `POST` | `/api/instructor/courses/{id}/assignments/{aId}/token` | Generate student submission token |

#### Submissions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/submissions` | List all submissions (anonymised) |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/submissions/download` | Download all as ZIP |

#### Analysis
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/instructor/courses/{id}/assignments/{aId}/analysis` | Trigger analysis job |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/analysis` | Get analysis report |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/analysis/{pairId}` | Get single pair detail |
| `DELETE` | `/api/instructor/courses/{id}/assignments/{aId}/analysis/{runId}` | Delete analysis run |
| `DELETE` | `/api/instructor/courses/{id}/assignments/{aId}/analysis` | Delete all analysis runs |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/analysis/reveal-status` | Check reveal status for a pair |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/analysis/reveal-approvals` | List all approved reveals |
| `POST` | `/api/instructor/courses/{id}/assignments/{aId}/analysis/reveal-request` | Request identity reveal |

#### References & Boilerplate
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/instructor/courses/{id}/assignments/{aId}/references` | Upload reference ZIP |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/references` | List references |
| `DELETE` | `/api/instructor/courses/{id}/assignments/{aId}/references/{refId}` | Delete reference |
| `POST` | `/api/instructor/courses/{id}/assignments/{aId}/template` | Upload boilerplate files |
| `GET` | `/api/instructor/courses/{id}/assignments/{aId}/template` | List boilerplate files |
| `DELETE` | `/api/instructor/courses/{id}/assignments/{aId}/template/{fileId}` | Delete boilerplate file |

---

### University Admin — `/api/admin`

**Role required:** `university_admin`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Instructor count, course count |
| `GET` | `/api/admin/instructors` | List instructors |
| `POST` | `/api/admin/instructors` | Create instructor account |
| `DELETE` | `/api/admin/instructors/{id}` | Delete instructor |
| `GET` | `/api/admin/courses` | List all courses in the university |
| `GET` | `/api/admin/courses/{id}/details` | Course details with submission counts |
| `GET` | `/api/admin/reveal-requests` | List pending reveal requests |
| `POST` | `/api/admin/reveal-requests/{id}/approve` | Approve a reveal request |
| `POST` | `/api/admin/reveal-requests/{id}/decline` | Decline a reveal request |

---

### Super Admin — `/api/super-admin`

**Role required:** `super_admin`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/super-admin/dashboard` | University count, total admin count |
| `GET` | `/api/super-admin/universities` | List all universities |
| `POST` | `/api/super-admin/universities` | Create a university |
| `PATCH` | `/api/super-admin/universities/{id}` | Update university details |
| `DELETE` | `/api/super-admin/universities/{id}` | Delete a university |
| `GET` | `/api/super-admin/universities/{id}/admins` | List university admins |
| `POST` | `/api/super-admin/universities/{id}/admins` | Create a university admin |
| `DELETE` | `/api/super-admin/universities/{id}/admins/{adminId}` | Delete a university admin |

---

## 6. Analysis Engine — Technical Specification

The engine lives entirely in `backend/src/services/comparison_engine.py`. It operates on a folder of student ZIP files and produces a structured results dict that is stored in MongoDB.

### 6.1 Constants and Tuning Parameters

| Constant | Value | Effect |
|---|---|---|
| `SIMILARITY_THRESHOLD` | `0` | Pairs above this score are reported (0 = all pairs) |
| `UNIT_MATCH_THRESHOLD` | `0.16` | Minimum block density to include in output |
| `FILE_SIMILARITY_THRESHOLD` | `0.90` | Score above which entire file is flagged as FILE confidence |
| `ADAPTIVE_K_THRESHOLDS` | `[(30,3),(60,4),(200,5),(500,7)]` | k-gram size breakpoints by token count |
| `ADAPTIVE_K_MAX` | `9` | Maximum k for large files |
| `MIN_TOKEN_DIVERSITY` | `3` | Minimum distinct token types in a k-gram |

### 6.2 Token Normalisation

The AST is walked by `normalize_ast()` and tokens are emitted in two categories:

**LEXICAL_MAP** — leaf nodes normalised to generic types:

| Source AST type | Token emitted |
|---|---|
| `identifier`, `field_identifier` | `ID` |
| `type_identifier`, `primitive_type` | `TYPE` |
| `decimal_integer_literal`, `number_literal` | `NUM` |
| `string_literal`, `character_literal` | `STR` |
| `true`, `false` | `BOOL` |
| `null_literal`, `null` | `NULL` |

**STRUCTURAL_MAP** — expression nodes:

| Source AST type | Token emitted |
|---|---|
| `method_declaration`, `function_definition`, `constructor_declaration` | `FUNC_DEF` |
| `assignment_expression` | `ASSIGN` |
| `method_invocation`, `call_expression` | `CALL` |
| `object_creation_expression`, `new_expression` | `NEW` |
| `return_statement` | `RETURN` |
| `binary_expression` | `BIN_OP` |
| `variable_declarator`, `local_variable_declaration` | `VAR_DECL` |

**IGNORE_NODE_TYPES** — transparent (recurse into children, emit nothing):
Comments, block delimiters, punctuation, includes, parameter lists, and other structural noise.

### 6.3 Semantic Enrichment Tokens

After structural tokenisation, `_emit_call_semantics()` and `_emit_expr_semantics()` inject additional tokens for high-signal patterns that indicate shared algorithm implementations:

| Pattern | Semantic token |
|---|---|
| `.append()` / `.push_back()` | `ACCUM_APPEND` |
| `+= x` | `ACCUM_APPEND` |
| `StringBuilder` / `stringstream` init | `ACCUM_INIT` |
| `sort(...)` call | `SORT_CALL` |
| `== ` comparison | `EQ_TEST` |
| `>= / <=` comparison | `RANGE_TEST` |
| `array[i]` access | `ARRAY_READ` |
| `cout` / `printf` / `println` | `PRINT_CALL` |
| `++` / `--` | `INCREMENT` / `DECREMENT` |

### 6.4 Adaptive K-gram Parameters

```
token_count < 30  →  k=3, window=2
token_count < 60  →  k=4, window=3
token_count < 200 →  k=5, window=4
token_count < 500 →  k=7, window=5
token_count ≥ 500 →  k=9, window=5
```

A k-gram is only generated if:
1. All k tokens originate from the same source file.
2. The token type set has at least `MIN_TOKEN_DIVERSITY` distinct types.

### 6.5 Winnowing (Fingerprint Selection)

Implements the Moss winnowing algorithm:

```
for each window of size w over the hash sequence:
    select the minimum hash in the window
    if rightmost minimum ≠ previously selected:
        add to fingerprints
```

Tie-breaking chooses the **rightmost** occurrence of the minimum hash (original Moss specification).

### 6.6 IDF Weighting

```
weight(hash) = 1 / log(1 + document_frequency)
```

where `document_frequency` = number of students whose fingerprint set contains this hash.

The IDF-weighted Jaccard score between students A and B:

```
score = Σ weight(h) for h in (A ∩ B)
        ─────────────────────────────────
        Σ weight(h) for h in (A ∪ B)
```

### 6.7 Block Merging and Confidence Assignment

Raw fingerprint matches are grouped into `MatchBlock` objects by:
1. Collecting all (file_a, file_b) match pairs for a student pair.
2. Sorting by start line.
3. Merging overlapping or adjacent ranges into single blocks.
4. Assigning confidence:

| Condition | Confidence |
|---|---|
| Pair similarity ≥ `FILE_SIMILARITY_THRESHOLD` AND same filename | `FILE` |
| Block density ≥ 0.65 AND inside a named method | `HIGH` |
| Block density ≥ 0.35 | `MEDIUM` |
| Otherwise | `LOW` |

Blocks with density below `UNIT_MATCH_THRESHOLD` (0.16) are discarded.

### 6.8 Parallelism

The engine uses `ProcessPoolExecutor` (one worker per CPU core) to extract and fingerprint student ZIPs in parallel. The comparison phase iterates candidate pairs sequentially but is fast because only pairs sharing ≥ 1 hash are compared (inverted index optimisation).

---

## 7. Frontend — Module Reference

### `app/` — Page Components (Next.js App Router)

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page with institution selector |
| `/submit/[slug]/[token]` | `app/submit/...` | Student submission portal |
| `/instructor/courses` | `app/instructor/courses/page.tsx` | Course list |
| `/instructor/courses/[id]/assignments/[aId]/analysis` | `.../analysis/page.tsx` | Analysis report (pair list, stats) |
| `/instructor/courses/[id]/assignments/[aId]/analysis/[pairId]` | `.../[pairId]/page.tsx` | Pair detail (side-by-side diff viewer) |
| `/admin/*` | `app/admin/...` | University admin panel |
| `/super-admin/*` | `app/super-admin/...` | Super-admin panel |

### `middleware.ts`
Next.js Edge middleware that runs before every request. Reads the JWT from the `token` cookie (set at login) and redirects unauthenticated users to `/`. Allows public routes (`/`, `/submit/*`, `/api/*`) without a token.

### `lib/api.ts`
Central HTTP client. All backend calls go through `apiFetch<T>()`:
- Prepends `NEXT_PUBLIC_API_URL` (default: `http://127.0.0.1:8000`).
- Attaches the Bearer token from localStorage.
- Throws `ApiError` with the backend `detail` message on non-2xx responses.
- Redirects to `/` on 401 (token expired or invalid).

### `lib/auth.ts`
Client-side auth utilities:
- `login()` — POST credentials, store token in localStorage + cookie.
- `logout()` — Clear both stores, redirect to `/`.
- `getCurrentUser()` — Decode JWT payload, check expiry, return `User` object.
- `getDashboardPath(role)` — Map role → home page path.

### `components/analysis/code-diff-viewer.tsx`
The most complex component. Key internal structure:

```
CodeDiffViewer
  ├── buildLineMap()         — build line → {blockId, confidence} map per student file
  ├── stripComments()        — remove comments, preserve original line numbers
  ├── Panel (×2)             — left (student_1) and right (student_2)
  │     ├── renders source as HTML <table>
  │     ├── highlights matched lines with confidence colours
  │     ├── scrolls to focused block on block selection
  │     └── BlockTooltip     — hover overlay on focused lines
  └── useEffect              — auto-scrolls both panels when focusedBlockId changes
```

**Tab system** (`page.tsx` → `getFilePairsFromBlocks`):
- Builds `{fileA, fileB}[]` pairs from `pair.blocks[].file_a/file_b`.
- Each tab shows one file pair; cross-file blocks (e.g. `utils.cpp ↔ main.cpp`) get their own tab.
- `activeBlockIds` is the intersection of block IDs present in both `fileA` (student_1) and `fileB` (student_2), preventing cross-tab bleed-through.

---

## 8. Security Model

### 8.1 Authentication

- JWT HS256 tokens signed with `JWT_SECRET`.
- Tokens expire after 24 hours (`JWT_EXPIRY_MINUTES = 1440`).
- Token payload: `{ "sub": user_id, "role": "...", "slug": "...", "exp": timestamp }`.
- No refresh tokens — expired sessions require re-login.
- All protected API endpoints validate the token via the `get_current_user` FastAPI dependency.

### 8.2 Role-Based Access Control

| Role | Scope | Access |
|---|---|---|
| `super_admin` | Platform-wide | All universities, all admins |
| `university_admin` | One university | All instructors and courses in their university; reveal approvals |
| `instructor` | Own courses only | Their courses, assignments, submissions, analysis |
| Student | None (no account) | Public submission portal only (authenticated by assignment token) |

### 8.3 Student Identity Encryption

Student submissions store PII (name, email) encrypted:
1. **Name + email** — Fernet-encrypted (AES-128-CBC + HMAC-SHA256). Stored as ciphertext in MongoDB. The encryption key is derived from `JWT_SECRET` via PBKDF2.
2. **Student number** — stored plaintext (used as a folder key for file storage lookup).
3. **Submission ID** — HMAC-SHA256(JWT_SECRET, `student_number:name:email`)[:16]. Used as the disk folder name; deterministic so the same student always maps to the same folder.
4. **Analysis output** — all pairs use anonymous labels (`Student A`, `Student B`, etc.). The real student-to-label mapping is stored encrypted and only resolved after a university admin approves a reveal request.

### 8.4 File Encryption at Rest

All uploaded source files are encrypted before writing to disk using `encrypt_bytes()`. Files are decrypted in-memory only when needed (during analysis or download) and never written to disk in plaintext.

File storage path:
```
UPLOAD_DIR/{university_slug}/{course_id}/{assignment_id}/{submission_id}/{filename}.enc
```

### 8.5 Assignment Tokens

Student submission links contain a short-lived JWT signed with `JWT_SECRET` embedding:
- `course_id`, `assignment_id`, `university_slug`
- Expiry timestamp (set when instructor generates the token)

Students present this token to the public submission endpoint instead of a user account. This means students never need to create an account or log in.

---

## 9. Data Flow Diagrams

### Student Submission Flow

```
Student Browser
     │
     │ 1. Enter assignment token on /submit page
     ▼
GET /api/public/assignment?token=...
     │
     │ 2. Validate JWT; return course/assignment metadata
     ▼
Student fills form (name, email, student number, files)
     │
     │ 3. POST /api/public/submit (multipart/form-data)
     ▼
Backend: submission.py
     │  a. Decode assignment token
     │  b. Encrypt name + email with Fernet
     │  c. Derive submission_id = HMAC(JWT_SECRET, number:name:email)[:16]
     │  d. Encrypt each uploaded file
     │  e. Write encrypted files to UPLOAD_DIR/.../{submission_id}/
     │  f. Insert submission document into MongoDB
     │  g. Send email receipt (async, non-blocking)
     ▼
Return SubmissionResponse to browser
```

### Analysis Job Flow

```
Instructor clicks "Run Analysis"
     │
     │ POST /api/instructor/courses/{id}/assignments/{aId}/analysis
     ▼
Backend: instructor.py → trigger_analysis()
     │  a. Create analysis_run document (status: "running")
     │  b. Launch background thread → run_analysis_job()
     │
     ▼ (returns immediately with job ID)

Background Thread: analysis.py → run_analysis_job()
     │  a. prepare_submission_zips() — decrypt files, build per-student ZIPs
     │  b. run_engine(submissions_folder, boilerplate_folder)
     │       └── [see engine pipeline in Section 6]
     │  c. Store results in analysis_run document (status: "completed")
     │
     ▼

Instructor polls GET /api/instructor/.../analysis
     │  Returns status + full pair list when completed
     ▼
Instructor opens pair → GET /api/instructor/.../analysis/{pairId}
     │  Returns single pair with blocks + source code
     ▼
Frontend renders CodeDiffViewer with highlighted blocks
```

### Identity Reveal Flow

```
Instructor clicks "Reveal Identity"
     │
     │ POST /api/instructor/.../analysis/reveal-request
     │   { pair_id, justification }
     ▼
Backend inserts reveal_request (status: "pending")

University Admin logs in → /admin/reveal-requests
     │
     │ POST /api/admin/reveal-requests/{id}/approve
     ▼
Backend decrypts student_name + student_email from submission document
Returns decrypted identity in reveal-status response

Instructor sees real names on pair detail page
```

---

*End of Technical Specification & Source Code Documentation*
