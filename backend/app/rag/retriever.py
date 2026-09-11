"""RAG Retriever — pgvector cosine similarity search for knowledge documents."""
import logging
from typing import List, Optional

logger = logging.getLogger("shopmind.rag.retriever")


def retrieve_context(query: str, top_k: int = 3) -> str:
    """Retrieve most relevant knowledge documents for a query."""
    try:
        from app.rag.embedder import embed_query
        from app.db.session import engine
        from app.models import KnowledgeDocument
        from sqlmodel import Session, select, text

        query_embedding = embed_query(query)

        with Session(engine) as db:
            if query_embedding:
                # pgvector cosine similarity search
                results = db.exec(
                    select(KnowledgeDocument)
                    .order_by(
                        KnowledgeDocument.embedding.cosine_distance(query_embedding)
                    )
                    .limit(top_k)
                ).all()
            else:
                # Fallback: keyword search in content
                keyword = query.lower()[:30]
                all_docs = db.exec(select(KnowledgeDocument)).all()
                results = [d for d in all_docs if keyword in d.content.lower()][:top_k]
                if not results:
                    results = all_docs[:top_k]

            if not results:
                return "No relevant policy documents found in the knowledge base."

            chunks = []
            for doc in results:
                chunks.append(f"### {doc.title} ({doc.category})\n{doc.content}")
            return "\n\n---\n\n".join(chunks)

    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return f"Knowledge base retrieval temporarily unavailable."
