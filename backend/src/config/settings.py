from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str
    DB_NAME: str = "academic_fbi"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60

    model_config = {"env_file": ".env"}


settings = Settings()
