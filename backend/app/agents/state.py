"""LangGraph AgentState definition."""
from typing import Annotated, Any, Dict, List, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
import operator


class AgentState(TypedDict):
    session_id: str
    trace_id: str
    user_id: Optional[int]
    trigger_event: str
    trigger_payload: Dict[str, Any]
    messages: Annotated[List[BaseMessage], operator.add]
    active_agent: str
    agent_results: Dict[str, Any]
    action_proposals: List[Dict[str, Any]]
    executed_actions: List[Dict[str, Any]]
    requires_approval: bool
    approval_status: Optional[str]
    approver_id: Optional[int]
    final_response: Optional[str]
    error: Optional[str]
