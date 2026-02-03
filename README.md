# CodeIntegrity - Academic Integrity Checker

A web-based plagiarism detection system for academic code submissions. The system analyzes source code submissions for similarities, helping instructors maintain academic integrity standards.

## 📋 Project Overview

This system allows instructors to:
- Receive and manage student code submissions
- Analyze submissions for code similarity against other submissions and historical repositories
- View detailed similarity reports in a user-friendly web interface
- Maintain student confidentiality through anonymization

### Key Features

- **Multi-language Support**: C, C++, and Java
- **Repository Management**: Compare against current class submissions, previous offerings, or custom repositories
- **Similarity Analysis Engine**: Custom-built comparison algorithm (no external AI dependencies)
- **Anonymization**: FIPPA-compliant handling of student information
- **Web-based Interface**: Accessible from any browser

## 🏗️ Project Structure

```
├── backend/                    # Server-side application
│   ├── src/
│   │   ├── api/               # REST API endpoints
│   │   ├── analysis/          # Code similarity analysis engine
│   │   │   ├── tokenizer/     # Language-specific tokenizers
│   │   │   ├── comparator/    # Similarity comparison algorithms
│   │   │   └── fingerprint/   # Code fingerprinting utilities
│   │   ├── models/            # Database models
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Helper utilities
│   │   └── config/            # Configuration files
│   ├── tests/                 # Backend tests
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # Client-side application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API communication
│   │   ├── store/             # State management
│   │   └── utils/             # Frontend utilities
│   ├── public/                # Static assets
│   └── package.json           # Node.js dependencies
│
├── database/                   # Database schemas and migrations
│   ├── migrations/
│   └── seeds/
│
├── repositories/               # Stored code repositories for comparison
│   └── .gitkeep
│
├── docs/                       # Documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # System architecture docs
│   └── user-guide/            # User documentation
│
├── scripts/                    # Utility scripts
│
├── docker-compose.yml          # Docker configuration
├── .gitignore
├── .env.example               # Environment variables template
└── README.md
```

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Python (Flask/FastAPI) |
| Frontend | React.js |
| Database | PostgreSQL |
| Cache | Redis |
| Containerization | Docker |
| Web Server | Nginx |

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

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
   cd frontend
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   # Instructions to be added
   ```

6. **Run the application**
   ```bash
   # Backend
   cd backend && python run.py

   # Frontend (separate terminal)
   cd frontend && npm start
   ```

### Using Docker

```bash
docker-compose up --build
```

## 📊 Similarity Analysis Engine

The core comparison engine uses a multi-phase approach:

1. **Tokenization**: Source code is parsed into language-specific tokens
2. **Normalization**: Variable names, comments, and whitespace are normalized
3. **Fingerprinting**: Code segments are converted to hash fingerprints
4. **Comparison**: Fingerprints are compared using algorithms like:
   - Winnowing algorithm
   - N-gram analysis
   - AST (Abstract Syntax Tree) comparison

> ⚠️ **Note**: The comparison engine is developed in-house. No external AI services are used for code comparison to ensure compliance with project requirements.

## 🔒 Privacy & Security

- All submissions are anonymized before processing
- Personal identifiable information (PII) is encrypted at rest
- FIPPA-compliant data handling
- Role-based access control (RBAC)

## 📖 API Documentation

API documentation is available at `/api/docs` when running the server, or in the [docs/api](docs/api) directory.

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 👥 Team

COSC 4P02 - Software Engineering II - Winter 2026

## 📄 License

This project is developed for academic purposes as part of COSC 4P02 at Brock University.

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

**Note**: This system is designed for educational institution use and must be deployed in compliance with applicable privacy regulations.
