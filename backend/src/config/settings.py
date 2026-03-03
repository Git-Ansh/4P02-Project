from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str
    DB_NAME: str = "academic_fbi"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60
    UPLOAD_DIR: str = "/opt/academic-fbi/uploads"

    # Brevo email (preferred — set API key + from email)
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""
    BREVO_FROM_NAME: str = "AcademicFBI"

    # SMTP fallback (used only if Brevo is not set)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "AcademicFBI"

    model_config = {"env_file": ".env"}


settings = Settings()
