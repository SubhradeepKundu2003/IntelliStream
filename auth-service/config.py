from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SECRET_KEY: str = "supersecretkey-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/intellistream_auth"

    DEFAULT_ADMIN_EMAIL: str = "admin@example.com"
    DEFAULT_ADMIN_PASSWORD: str = "Tcs#1234"

    SPRINGBOOT_BASE_URL: str = "http://localhost:8081"

    DPI_WEIGHT: float = 0.40
    SCORE_WEIGHT: float = 0.60

    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "gpt-oss:20b"
    OLLAMA_TIMEOUT: float = 1800.0


settings = Settings()
