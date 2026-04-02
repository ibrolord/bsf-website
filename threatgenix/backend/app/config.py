from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://threatgenix:password@localhost:5432/threatgenix"
    bedrock_region: str = "ca-central-1"
    bedrock_model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    bedrock_max_tokens: int = 4096
    bedrock_timeout_seconds: int = 30
    allowed_origins: str = "http://localhost:5173"
    pdf_max_pages: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
