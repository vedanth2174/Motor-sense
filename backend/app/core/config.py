import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "sqlite:///./motor_data.db"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:8443",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8443",
        "http://motorsense.local"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Authentication & Security
    AUTH_ENABLED: bool = False
    OIDC_ISSUER: str = "http://localhost:8080/realms/motorsense"
    OIDC_JWKS_URL: str = "http://localhost:8080/realms/motorsense/protocol/openid-connect/certs"
    OIDC_AUDIENCE: str = "motorsense-api"

    # ML & Baseline
    MODEL_DIR: str = "./models"
    BASELINE_MIN_SAMPLES: int = 500

    # LLM Diagnostics
    LLM_PROVIDER: str = "none"  # "ollama", "openrouter", "none"
    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_MODEL: str = "qwen2.5:7b"
    LLM_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
