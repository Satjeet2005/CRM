from fastapi import APIRouter

from app.api.v1.accounts import router as accounts_router
from app.api.v1.activity import router as activity_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.auth import router as auth_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.opportunities import router as opportunities_router
from app.api.v1.proposals import router as proposals_router
from app.api.v1.quotes import router as quotes_router
from app.api.v1.rfqs import router as rfqs_router
from app.api.v1.tasks import router as tasks_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(accounts_router)
api_v1_router.include_router(contacts_router)
api_v1_router.include_router(opportunities_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(rfqs_router)
api_v1_router.include_router(quotes_router)
api_v1_router.include_router(proposals_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(catalog_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(activity_router)
