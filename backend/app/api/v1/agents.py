"""Agent chat API route."""
import logging
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.models import User
from app.schemas import ChatRequest, ChatResponse

logger = logging.getLogger("shopmind.api.agents")
router = APIRouter(tags=["agents"])


@router.post("/agents/chat", response_model=ChatResponse)
def agent_chat(request: ChatRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.agents.graph import run_agent
    result = run_agent(
        trigger_event="USER_CHAT",
        payload={"session_id": request.session_id},
        user_message=request.message,
        user_id=user.id,
    )
    return ChatResponse(
        response=result.get("response", "I'm sorry, I couldn't process that request."),
        agent=result.get("agent", "orchestrator"),
        trace_id=result.get("trace_id", ""),
        requires_approval=result.get("requires_approval", False),
    )
