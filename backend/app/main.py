"""ShopMind FastAPI Application Entry Point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, text

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import ShopMindException, shopmind_exception_handler
from app.db.session import engine

logger = logging.getLogger("shopmind.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup logging
    setup_logging(log_level=settings.LOG_LEVEL, secret_keys=[settings.GEMINI_API_KEY, settings.JWT_SECRET_KEY])
    logger.info("=" * 60)
    logger.info("  ShopMind AI-Powered E-Commerce Operations Platform v1.0")
    logger.info("=" * 60)

    # Initialize database
    try:
        from app.db.init_db import init_db
        init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    # Load RAG knowledge base
    try:
        from app.rag.loader import load_knowledge_base
        count = load_knowledge_base()
        if count > 0:
            logger.info(f"✅ Knowledge base loaded: {count} documents")
        else:
            logger.info("✅ Knowledge base already loaded")
    except Exception as e:
        logger.warning(f"⚠️  Knowledge base loading failed: {e}")

    # Test Redis
    try:
        from app.core.redis import redis_client
        if redis_client.ping():
            logger.info("✅ Redis connected")
            # Start event consumer
            from app.events.consumer import start_consumer, register_handler
            from app.agents.graph import run_agent

            register_handler("STOCK_LOW", lambda p: run_agent("STOCK_LOW", p, "Analyze and handle the low stock situation."))
            register_handler("SHIPMENT_DELAYED", lambda p: run_agent("SHIPMENT_DELAYED", p, "Handle this delayed shipment."))
            register_handler("ORDER_CREATED", lambda p: run_agent("ORDER_CREATED", p, "Process this new order."))
            start_consumer()
            logger.info("✅ Event consumer started")
        else:
            logger.warning("⚠️  Redis not available — event consumer disabled")
    except Exception as e:
        logger.warning(f"⚠️  Redis setup failed: {e}")

    logger.info("🚀 ShopMind Backend ready!")
    yield
    logger.info("Shutting down ShopMind...")


app = FastAPI(
    title="ShopMind API",
    description="AI-Powered Autonomous E-Commerce Operations Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Exception handler
app.add_exception_handler(ShopMindException, shopmind_exception_handler)

# Register routers
from app.api.v1 import router as v1_router
app.include_router(v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"name": "ShopMind API", "version": "1.0.0", "docs": "/api/docs"}
