import logging
import sys
import time
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.health import router as health_router
from app.api.v1.router import api_v1_router
from app.config import settings
from app.telemetry import (
    StructuredLogFormatter,
    log_http_request,
    sanitize_or_generate_request_id,
)

root_logger = logging.getLogger()
root_logger.setLevel(settings.LOG_LEVEL)

if settings.is_production:
    json_handler = logging.StreamHandler(sys.stdout)
    json_handler.setFormatter(StructuredLogFormatter())
    root_logger.handlers = [json_handler]
else:
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s [%(levelname)s] %(name)s (req=%(request_id)s): %(message)s",
    )
logger = logging.getLogger("forgeflow")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup validation
    settings.validate_production_guards()
    yield
    # Shutdown logic if needed


app = FastAPI(
    title="ForgeFlow API",
    description="Modular monolith backend for ForgeFlow B2B platform",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
allowed_origins = [settings.FRONTEND_ORIGIN]
if settings.APP_ENV in {"development", "test"}:
    allowed_origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Content-SHA256", "Content-Disposition"],
)


@app.middleware("http")
async def request_context_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Assigns or propagates sanitized X-Request-ID correlation header and records duration."""
    raw_req_id = request.headers.get("x-request-id")
    request_id = sanitize_or_generate_request_id(raw_req_id)
    request.state.request_id = request_id

    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        log_http_request(request, response.status_code, duration_ms, request_id)
        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            f"Request failed: method={request.method} path={request.url.path} "
            f"duration_ms={duration_ms} (req={request_id}): {exc}"
        )
        raise


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    detail = exc.detail

    if isinstance(detail, dict):
        code = detail.get("code", "ERROR")
        message = detail.get("message", str(detail))
        details = detail.get("details", None)
    else:
        code = "HTTP_ERROR"
        message = str(detail)
        details = None

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    safe_errors = []
    for err in exc.errors():
        loc = [str(x) for x in err.get("loc", []) if x not in {"body"}]
        safe_errors.append(
            {
                "field": ".".join(loc),
                "message": err.get("msg", "Invalid value"),
            }
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Input validation failed",
            "details": safe_errors,
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    # Log securely without exposing to response
    logger.error(f"Unhandled error (req={request_id}): {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please contact support.",
            "details": None,
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id},
    )


# Attach routers
app.include_router(health_router)
app.include_router(api_v1_router)
