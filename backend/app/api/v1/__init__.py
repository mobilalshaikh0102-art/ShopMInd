"""API v1 router — combines all sub-routers."""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.routes import router as routes_router
from app.api.v1.agents import router as agents_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.logistics import router as logistics_router
from app.api.v1.ai_tools import router as ai_tools_router
from app.api.v1.crm import router as crm_router
from app.api.v1.security_mgmt import router as security_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(routes_router)
router.include_router(agents_router)
router.include_router(analytics_router)
router.include_router(integrations_router)
router.include_router(logistics_router)
router.include_router(ai_tools_router)
router.include_router(crm_router)
router.include_router(security_router)
