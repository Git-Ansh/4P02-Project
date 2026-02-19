# API Documentation

API reference for **Academic FBI**.

## Interactive Docs

The backend is built with FastAPI, which auto-generates interactive API documentation:

| Interface | URL |
|-----------|-----|
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |
| OpenAPI JSON | `http://localhost:8000/openapi.json` |

## Resource Groups

The API is organized around the following resource groups:

| Resource | Description |
|----------|-------------|
| **Auth** | Registration, login, token refresh, password reset |
| **Courses** | CRUD for courses; enroll / remove instructors |
| **Assignments** | Create assignments, set deadlines, generate assignment keys |
| **Submissions** | Upload, resubmit, list, and download student submissions |
| **Repositories** | Manage comparison repositories (upload, list, delete) |
| **Analysis** | Trigger similarity analysis jobs, check job status |
| **Reports** | Retrieve similarity scores, flagged pairs, and aggregated results |

## Authentication

All endpoints (except login / register) require a valid JWT bearer token. Tokens are issued by the Auth endpoints and must be included in the `Authorization` header:

```
Authorization: Bearer <token>
```

Role-based access control restricts endpoints by user role (Student, Instructor, Administrator).
