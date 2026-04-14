"""
Application settings loaded from environment variables / .env file.

All values are validated by Pydantic on startup.  Missing required fields
(MONGODB_URI, JWT_SECRET) will raise a ValidationError and prevent the
server from starting, which is intentional — failing fast is safer than
running with missing credentials.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Central configuration object.

    Required env vars:
        MONGODB_URI   — MongoDB Atlas connection string.
        JWT_SECRET    — Secret used to sign and verify JWT tokens.  Must be
                        kept private; changing it invalidates all active sessions.

    Optional env vars:
        DB_NAME           — MongoDB database name (default: academic_fbi).
        JWT_ALGORITHM     — JWT signing algorithm (default: HS256).
        JWT_EXPIRY_MINUTES— Token lifetime in minutes (default: 1440 = 24 h).
        UPLOAD_DIR        — Root directory for encrypted submission files.
        BREVO_*           — Brevo (Sendinblue) transactional email credentials.
        SMTP_*            — SMTP fallback credentials (used if Brevo not set).
    """
    MONGODB_URI: str
    DB_NAME: str = "academic_fbi"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 1440  # 24 hours
    UPLOAD_DIR: str = "/opt/academic-fbi/uploads"

    # SMTP settings for email receipts (optional — emails silently skip if not set)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "AcademicFBI"

    # Brevo (Sendinblue) API settings (preferred over SMTP)
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""
    BREVO_FROM_NAME: str = "AcademicFBI"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
