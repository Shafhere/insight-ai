
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    # Application settings
    app_name: str = "INSIGHT AI"
    app_environment: str = "development"
    debug: bool = True

    api_prefix: str = "/api/v1"

    max_upload_size_mb: int = 50

    storage_dir: Path = BACKEND_DIR / "storage"

    frontend_url: str = "http://localhost:5173"

    # Portal, persistence and background-worker settings
    database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"
    insight_admin_email: str = "admin@insight.ai"
    insight_admin_password: str = "ChangeMe123!"
    insight_auth_secret: str = "change-this-insight-secret-before-deployment"

    # AI provider settings
    llm_provider: str = "groq"

    # Secret key is loaded from backend/.env
    groq_api_key: str = ""

    # Default model can be overridden through .env
    groq_model: str = "openai/gpt-oss-120b"

    # Load configuration from the backend directory,
    # regardless of the directory used to start the application.
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Ensure application storage exists
settings.storage_dir.mkdir(parents=True, exist_ok=True)
