from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "eSketcher API"
    version: str = "0.1.0"
    env: Literal["development", "test", "production"] = "development"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "sqlite+aiosqlite:///./esketcher.db"
    max_project_bytes: int = 5_000_000

    jev_mode: Literal["mock", "real"] = "mock"
    typesafe_api_key: SecretStr = SecretStr("")
    typesafe_base_url: str = "https://api.typesafe.ai"
    jev_model: str = "jev-latest"
    jev_timeout_seconds: float = 8.0
    jev_rate_limit_per_minute: int = 90

    @model_validator(mode="after")
    def _real_mode_needs_key(self) -> "Settings":
        if self.jev_mode == "real" and not self.typesafe_api_key.get_secret_value().strip():
            raise ValueError("JEV_MODE=real requires TYPESAFE_API_KEY")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def docs_enabled(self) -> bool:
        return self.env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
