"""RAG Embedder — generates text embeddings using Google Gemini."""
import logging
from typing import List, Optional

logger = logging.getLogger("shopmind.rag.embedder")


def embed_text(text: str) -> Optional[List[float]]:
    """Generate an embedding vector for the given text using Gemini."""
    try:
        from app.core.config import settings
        import google.generativeai as genai

        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set — skipping embedding")
            return None

        genai.configure(api_key=settings.GEMINI_API_KEY)
        result = genai.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return None


def embed_query(text: str) -> Optional[List[float]]:
    """Generate a query embedding for similarity search."""
    try:
        from app.core.config import settings
        import google.generativeai as genai

        if not settings.GEMINI_API_KEY:
            return None

        genai.configure(api_key=settings.GEMINI_API_KEY)
        result = genai.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return None
