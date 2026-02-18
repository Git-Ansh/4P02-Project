# CodeIntegrity - Agent Guidelines

> AI agent instructions for the CodeIntegrity academic plagiarism detection system.

## Project Overview

**CodeIntegrity** is a web-based plagiarism detection system for academic code submissions (C, C++, Java). It analyzes source code for similarities using a custom-built comparison engine.

**Stack:**
- **Frontend:** Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- **Backend:** Python 3.10+ + FastAPI + SQLAlchemy + PostgreSQL + Redis
- **Analysis Engine:** Custom tokenizer/comparator (no external AI)

---

## Build, Test & Lint Commands

### Frontend (`frontend/my-app/`)

```bash
# Development
cd frontend/my-app && npm run dev          # Start dev server on :3000

# Production
cd frontend/my-app && npm run build        # Build for production
cd frontend/my-app && npm run start        # Start production server

# Linting
cd frontend/my-app && npm run lint         # Run ESLint (eslint)
cd frontend/my-app && npx eslint src/      # Lint specific directory

# Type checking
cd frontend/my-app && npx tsc --noEmit     # TypeScript check without emit
```

### Backend (`backend/`)

```bash
# Setup (run once)
cd backend && python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Development
uvicorn src.main:app --reload              # Start dev server with hot reload

# Testing
pytest                                     # Run all tests
pytest tests/test_specific.py              # Run single test file
pytest -k test_function_name               # Run single test by name
pytest -x                                  # Stop on first failure
pytest -v                                  # Verbose output

# Code Quality
black src/ tests/                          # Format code
black --check src/ tests/                  # Check formatting
flake8 src/ tests/                         # Linting
isort src/ tests/                          # Sort imports
isort --check-only src/ tests/             # Check import order
```

---

## Code Style Guidelines

### TypeScript / React (Frontend)

**Imports:**
- Use `@/` alias for project imports (e.g., `@/components/ui/button`)
- Group: React → External libs → Internal (@/) → Relative
- Use `import * as React from "react"` (not default import)

**Formatting:**
- 2-space indentation
- Semicolons required
- Single quotes for strings
- Max 100 characters per line (soft limit)

**Naming:**
- Components: PascalCase (e.g., `Button`, `NavigationMenu`)
- Hooks: camelCase with `use` prefix (e.g., `useState`, `useEffect`)
- Utils: camelCase (e.g., `cn`, `formatDate`)
- Files: PascalCase for components, camelCase for utils

**Types:**
- Always use explicit types for props and function returns
- Use `React.ComponentProps<"element">` for HTML element props
- Prefer interfaces for object types
- Use `type` for unions, mapped types, and function types

**Components:**
```tsx
// Use function declarations, not const
function Button({ className, ...props }: ButtonProps) {
  return <button className={cn("base", className)} {...props} />;
}

// Destructure props in function signature
// Use `cn()` utility for Tailwind class merging
// Support `asChild` pattern for polymorphic components
```

**Tailwind CSS:**
- Use shadcn/ui design tokens (`bg-primary`, `text-destructive`)
- Merge classes with `cn()` utility from `@/lib/utils`
- Use `class-variance-authority` (cva) for component variants

### Python (Backend)

**Imports:**
- Group: stdlib → third-party → local
- Sort with isort (configured in requirements)
- Use absolute imports within `src/`

**Formatting:**
- Black formatter (88 character line length default)
- 4-space indentation
- Double quotes for strings

**Naming:**
- Functions/variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private: `_leading_underscore`

**Types:**
- Use type hints for all function signatures
- Use `from __future__ import annotations` for postponed evaluation
- Use Pydantic models for API request/response schemas

**Docstrings:**
```python
def calculate_similarity(code1: str, code2: str) -> float:
    """Calculate similarity between two code snippets.
    
    Args:
        code1: First code snippet
        code2: Second code snippet
        
    Returns:
        Similarity score between 0.0 and 1.0
    """
```

**Error Handling:**
- Use specific exceptions, not bare `except:`
- Log errors before raising in services
- Return proper HTTP status codes in API layer
- Use FastAPI's HTTPException for API errors

---

## Architecture Patterns

### Frontend

**shadcn/ui Components:**
- Located in `components/ui/`
- Use Radix UI primitives as base
- Style with Tailwind CSS
- Export from `components/ui/index.ts` if creating barrel exports

**Directory Structure:**
```
app/                    # Next.js App Router
├── page.tsx           # Route pages
├── layout.tsx         # Root layout
├── globals.css        # Global styles
└── [feature]/         # Feature folders
components/
├── ui/                # shadcn/ui components
└── [feature]/         # Custom components
lib/
└── utils.ts           # Utility functions (cn, etc.)
```

**State Management:**
- Use React hooks (`useState`, `useReducer`) for local state
- Lift state up when needed
- Consider Zustand or Redux Toolkit for global state (if added)

### Backend

**Directory Structure:**
```
src/
├── api/               # FastAPI routes/endpoints
├── analysis/          # Plagiarism detection engine
│   ├── tokenizer/     # Language parsers
│   ├── comparator/    # Similarity algorithms
│   └── fingerprint/   # Fingerprinting utilities
├── models/            # SQLAlchemy database models
├── services/          # Business logic layer
├── utils/             # Helper utilities
└── config/            # Configuration settings
```

**API Patterns:**
- Use dependency injection for DB sessions
- Validate with Pydantic models
- Use async/await for I/O operations
- Organize routes by resource (e.g., `/api/submissions`, `/api/analysis`)

---

## Testing Guidelines

### Frontend

- No test framework currently configured
- Recommended: Add Vitest + React Testing Library
- Test utilities in `__tests__/` or co-located as `[name].test.tsx`

### Backend

```python
# tests/test_example.py
import pytest
from src.services.analysis import calculate_similarity

def test_calculate_similarity_identical():
    code = "int main() { return 0; }"
    result = calculate_similarity(code, code)
    assert result == 1.0

@pytest.mark.asyncio
async def test_async_operation():
    result = await async_function()
    assert result is not None
```

---

## Environment & Secrets

- Copy `.env.example` to `.env` and configure
- Never commit `.env` files
- Use `pydantic-settings` for typed config in backend
- Frontend env vars must be prefixed with `NEXT_PUBLIC_`

---

## Common Tasks

**Add a new shadcn/ui component:**
```bash
cd frontend/my-app
npx shadcn add button
```

**Run database migrations:**
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

**Docker (full stack):**
```bash
docker-compose up --build
```

---

## Important Notes

- **No external AI** is used in the analysis engine (project requirement)
- Student submissions are **anonymized** before processing (FIPPA compliance)
- Allowed file extensions: `.c`, `.cpp`, `.cc`, `.h`, `.hpp`, `.java`
- Max upload size: 10MB per file (configurable in `.env`)
- Similarity threshold default: 0.7 (70%)
