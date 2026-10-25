import sys

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = Field(default="development")
    DEMO_MODE: bool = Field(default=True)
    APP_SECRET_KEY: str = Field(default="forgeflow-local-development-secret-key-32chars-min!")
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://forgeflow:forgeflow_dev@localhost:5434/forgeflow"
    )
    TEST_DATABASE_URL: str = Field(
        default="postgresql+psycopg://forgeflow:forgeflow_dev@localhost:5434/forgeflow_test"
    )
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000")
    SESSION_COOKIE_NAME: str = Field(default="forgeflow_session")
    SESSION_TTL_HOURS: int = Field(default=12)
    SESSION_IDLE_TTL_MINUTES: int = Field(default=60)
    CSRF_COOKIE_NAME: str = Field(default="forgeflow_csrf")
    LOG_LEVEL: str = Field(default="INFO")
    MAX_CSV_BYTES: int = Field(default=2097152)
    MAX_CSV_ROWS: int = Field(default=5000)
    MAX_RFQ_FILE_SIZE_BYTES: int = Field(default=5242880)  # 5 MiB per PRD Section 6.6
    MAX_RFQ_DATA_ROWS: int = Field(default=500)  # 500 rows per PRD Section 6.6

    @field_validator("MAX_RFQ_FILE_SIZE_BYTES", "MAX_RFQ_DATA_ROWS")
    @classmethod
    def validate_positive_limits(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("RFQ limit configurations must be positive integers")
        return v

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = {"development", "test", "production"}
        if v.lower() not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}, got '{v}'")
        return v.lower()

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_test(self) -> bool:
        return self.APP_ENV == "test"

    @property
    def cookie_secure(self) -> bool:
        return self.is_production

    def validate_production_guards(self) -> None:
        """Enforces security rules for production environments."""
        if self.is_production:
            if self.DEMO_MODE:
                raise ValueError("DEMO_MODE must be false in production environment!")
            if (
                len(self.APP_SECRET_KEY) < 32
                or "secret-key" in self.APP_SECRET_KEY
                or "development" in self.APP_SECRET_KEY
            ):
                raise ValueError(
                    "APP_SECRET_KEY must be a strong, non-default secret "
                    "at least 32 characters in production."
                )


settings = Settings()
try:
    settings.validate_production_guards()
except ValueError as e:
    # Fail fast on startup with clear error
    sys.stderr.write(f"CONFIGURATION ERROR: {e}\n")
    if settings.is_production:
        sys.exit(1)
