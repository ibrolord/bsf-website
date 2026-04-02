from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.dfd import router as dfd_router
from app.api.documents import router as documents_router
from app.api.threat_models import router as threat_models_router
from app.api.compliance import router as compliance_router
from app.api.threats import router as threats_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    logger = logging.getLogger("threatgenix.startup")
    try:
        from app.seed import seed
        await seed()
    except Exception as exc:
        logger.warning("Startup DB init failed (will retry on first request): %s", exc)
    yield


app = FastAPI(title="ThreatGenix", version="0.1.0", lifespan=lifespan)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(threat_models_router)
app.include_router(documents_router)
app.include_router(dfd_router)
app.include_router(threats_router)
app.include_router(compliance_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
