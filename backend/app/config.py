from os import environ
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from functools import lru_cache


def _load_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=True)


_load_env()


class Settings(BaseSettings):
    database_url: str = "postgresql://crm_user:crm_pass@localhost:5432/crm_core"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-this-to-a-random-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    sendgrid_api_key: str = ""
    from_email: str = "noreply@crm-core.local"
    whatsapp_api_key: str = ""
    whatsapp_phone_number_id: str = ""
    environment: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_full_name: str = "CRM Admin"
    bootstrap_admin_role: str = "admin"

    model_config = {"case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
