from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["Health"])

EXPECTED_ALEMBIC_HEAD = "0006_customer_exports"


@router.get("/health/live")
def liveness() -> dict[str, str]:
    """Lightweight liveness probe."""
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness probe verifying database connectivity and migration synchronization."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATABASE_UNAVAILABLE", "message": "Database connection failed"},
        ) from exc

    try:
        res = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if res != EXPECTED_ALEMBIC_HEAD:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "MIGRATIONS_OUTDATED",
                    "message": "Database schema is not synchronized with application release",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "MIGRATIONS_UNAVAILABLE",
                "message": "Unable to verify database migration readiness",
            },
        ) from exc

    return {"status": "ready", "database": "connected", "migrations": "current"}
