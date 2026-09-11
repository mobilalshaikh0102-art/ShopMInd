"""LangGraph multi-agent orchestrator — Supervisor + 7 specialized agents."""
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents import tools as T
from app.core.config import settings

logger = logging.getLogger("shopmind.orchestrator")


# ── LLM Setup ──────────────────────────────────────────────────────────────────

def _get_llm(temperature: float = 0.1):
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
    )


def _extract_text(content) -> str:
    """Extract plain text from LLM response content (handles both string and structured formats)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for x in content:
            if isinstance(x, dict):
                if x.get("type") == "text":
                    parts.append(x.get("text", ""))
                elif "text" in x:
                    parts.append(x["text"])
            elif isinstance(x, str):
                parts.append(x)
        return "".join(parts)
    return str(content)


# ── Supervisor ─────────────────────────────────────────────────────────────────

def supervisor_node(state: AgentState) -> AgentState:
    """Analyze intent and route to the appropriate specialized agent."""
    event = state.get("trigger_event", "UNKNOWN")
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else ""

    # Deterministic routing for event-driven triggers
    EVENT_ROUTING = {
        "STOCK_LOW": "inventory_agent",
        "ORDER_CREATED": "order_agent",
        "ORDER_CANCELLED": "order_agent",
        "SHIPMENT_DELAYED": "logistics_agent",
        "SHIPMENT_CREATED": "logistics_agent",
        "SUPPORT_TICKET_CREATED": "support_agent",
        "PRICE_CHANGE_REQUESTED": "pricing_agent",
    }

    if event in EVENT_ROUTING:
        active = EVENT_ROUTING[event]
    else:
        # NLP routing for user chat
        q = user_msg.lower()
        if any(k in q for k in ["stock", "inventory", "restock", "supply", "warehouse", "sku"]):
            active = "inventory_agent"
        elif any(k in q for k in ["order", "purchase", "buy", "cancel order", "order status"]):
            active = "order_agent"
        elif any(k in q for k in ["shipment", "delivery", "shipping", "track", "delay", "courier", "logistics"]):
            active = "logistics_agent"
        elif any(k in q for k in ["refund", "return", "policy", "warranty", "complaint", "ticket", "support", "help"]):
            active = "support_agent"
        elif any(k in q for k in ["price", "pricing", "discount", "cost", "margin", "revenue per unit"]):
            active = "pricing_agent"
        elif any(k in q for k in ["sales", "revenue", "analytics", "metric", "report", "insight", "performance", "kpi"]):
            active = "analytics_agent"
        elif any(k in q for k in ["campaign", "promotion", "marketing", "ad", "email", "advertise"]):
            active = "marketing_agent"
        else:
            active = "support_agent"

    logger.info(f"Supervisor → event={event}, query={user_msg[:60]!r}, routed to={active}")
    return {**state, "active_agent": active}


def route_from_supervisor(state: AgentState) -> str:
    return state.get("active_agent", "support_agent")


# ── Inventory Agent ────────────────────────────────────────────────────────────

def inventory_agent_node(state: AgentState) -> AgentState:
    """Detects low stock, analyzes inventory health, recommends restocking."""
    llm = _get_llm()
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Check inventory status."
    payload = state.get("trigger_payload", {})
    product_id = payload.get("product_id")

    if product_id:
        context = json.dumps(T.get_inventory_status(product_id), indent=2)
    else:
        low_stock = T.get_low_stock_products()
        all_inv = T.get_all_inventory_summary()
        context = f"LOW STOCK ITEMS:\n{json.dumps(low_stock, indent=2)}\n\nALL INVENTORY:\n{json.dumps(all_inv, indent=2)}"

    system = """You are ShopMind's Inventory Agent. Analyze inventory data and provide clear, actionable insights.
Your responsibilities:
- Identify products at risk of stockout
- Calculate days of stock remaining using sales velocity
- Recommend optimal restock quantities using EOQ principles
- Flag high-risk restock actions (cost > ₹5,000) for human approval
- Format responses clearly with product names, numbers, and recommendations
Always be concise and actionable."""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"INVENTORY DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "inventory_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Order Agent ────────────────────────────────────────────────────────────────

def order_agent_node(state: AgentState) -> AgentState:
    """Monitors order statuses, manages fulfillment pipeline."""
    llm = _get_llm()
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Check order status."
    payload = state.get("trigger_payload", {})
    order_id = payload.get("order_id")

    if order_id:
        context = json.dumps(T.get_order_details(order_id), indent=2)
    else:
        pending = T.get_orders_by_status("PENDING")
        processing = T.get_orders_by_status("PROCESSING")
        recent = T.get_recent_orders(5)
        context = f"PENDING ORDERS:\n{json.dumps(pending, indent=2)}\n\nPROCESSING ORDERS:\n{json.dumps(processing, indent=2)}\n\nRECENT ORDERS:\n{json.dumps(recent, indent=2)}"

    system = """You are ShopMind's Order Agent. Monitor and manage the order fulfillment pipeline.
Your responsibilities:
- Detect stalled, delayed, or problematic orders
- Summarize order queues by status
- Identify patterns in cancellations or delays
- Recommend actions to clear bottlenecks
- Provide clear order-by-order analysis when needed"""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"ORDER DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "order_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Support Agent ──────────────────────────────────────────────────────────────

def support_agent_node(state: AgentState) -> AgentState:
    """Answers customer queries using RAG-retrieved policies."""
    from app.rag.retriever import retrieve_context
    llm = _get_llm(temperature=0.2)
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "How can I help you?"

    rag_context = retrieve_context(user_msg, top_k=3)

    system = f"""You are ShopMind's Customer Support Agent. You help customers with orders, returns, and policies.
Your responsibilities:
- Answer queries based on the retrieved policy context provided
- For order-related questions, ask for an order number
- For refunds over ₹1,000, inform the customer it requires human review
- Be empathetic, professional, and concise
- If context is unavailable, say "I'll connect you with a human agent"

RETRIEVED POLICY CONTEXT:
{rag_context}"""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=user_msg)])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "support_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Pricing Agent ──────────────────────────────────────────────────────────────

def pricing_agent_node(state: AgentState) -> AgentState:
    """Generates dynamic pricing recommendations."""
    llm = _get_llm()
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Analyze pricing."

    recommendations = T.get_pricing_recommendations()
    context = json.dumps(recommendations, indent=2)

    system = """You are ShopMind's Pricing Agent. Optimize product pricing for revenue and margin goals.
Your responsibilities:
- Recommend price adjustments based on stock levels and sales velocity
- Respect floor (-20%) and ceiling (+30%) price boundaries
- Flag changes > 10% as HIGH RISK requiring human approval
- Calculate impact on revenue and margin
- Provide business rationale for each recommendation"""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"PRICING DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "pricing_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Logistics Agent ────────────────────────────────────────────────────────────

def logistics_agent_node(state: AgentState) -> AgentState:
    """Monitors shipments and handles delivery exceptions."""
    llm = _get_llm()
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Check shipment status."

    delayed = T.get_delayed_shipments()
    summary = T.get_all_shipments_summary()
    context = f"SHIPMENT SUMMARY:\n{json.dumps(summary, indent=2)}\n\nDELAYED SHIPMENTS:\n{json.dumps(delayed, indent=2)}"

    system = """You are ShopMind's Logistics Agent. Monitor all shipments and resolve delivery issues.
Your responsibilities:
- Identify delayed and at-risk shipments
- Recommend proactive customer notifications for delays > 2 days
- Suggest compensation (discount codes) for significant delays
- Coordinate with Order Agent for order status updates
- Summarize logistics health clearly with actionable next steps"""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"LOGISTICS DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "logistics_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Marketing Agent ────────────────────────────────────────────────────────────

def marketing_agent_node(state: AgentState) -> AgentState:
    """Identifies promotion opportunities and generates campaign copy."""
    llm = _get_llm(temperature=0.4)
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Identify marketing opportunities."

    pricing = T.get_pricing_recommendations()
    low_stock = T.get_low_stock_products()
    low_stock_skus = [x["sku"] for x in low_stock]
    promotable = [p for p in pricing if p["recommended_action"] == "DISCOUNT"]
    context = f"PROMOTABLE PRODUCTS:\n{json.dumps(promotable[:10], indent=2)}\n\nLOW STOCK (DO NOT PROMOTE):\n{json.dumps(low_stock_skus, indent=2)}"

    system = """You are ShopMind's Marketing Agent. Drive revenue through smart promotions.
Your responsibilities:
- Identify overstock products that need a promotional push
- NEVER promote low-stock products (fulfillment risk)
- Generate compelling, on-brand marketing copy
- Recommend campaign timing, channels (email, SMS, social), and target segments
- Suggest discount codes and their validity windows
- Estimate expected sales uplift from campaigns"""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"MARKETING DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "marketing_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Analytics Agent ────────────────────────────────────────────────────────────

def analytics_agent_node(state: AgentState) -> AgentState:
    """Translates business questions into metrics and insights."""
    llm = _get_llm()
    messages = state.get("messages", [])
    user_msg = messages[-1].content if messages else "Give me a business summary."

    summary = T.get_business_summary()
    category_sales = T.get_sales_by_category()
    context = f"BUSINESS METRICS:\n{json.dumps(summary, indent=2)}\n\nSALES BY CATEGORY:\n{json.dumps(category_sales, indent=2)}"

    system = """You are ShopMind's Analytics Agent. Turn raw business data into actionable insights.
Your responsibilities:
- Analyze business performance across orders, inventory, logistics, and support
- Detect unusual patterns, trends, and anomalies
- Provide clear, executive-level summaries
- Highlight critical issues needing immediate attention
- Give forward-looking recommendations, not just historical data
Format responses with clear sections and bullet points."""

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=f"ANALYTICS DATA:\n{context}\n\nUSER REQUEST: {user_msg}")])
    result = _extract_text(response.content)
    return {**state, "agent_results": {**state.get("agent_results", {}), "analytics_agent": result}, "final_response": result, "messages": [*messages, response]}


# ── Build Graph ────────────────────────────────────────────────────────────────

def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("inventory_agent", inventory_agent_node)
    graph.add_node("order_agent", order_agent_node)
    graph.add_node("support_agent", support_agent_node)
    graph.add_node("pricing_agent", pricing_agent_node)
    graph.add_node("logistics_agent", logistics_agent_node)
    graph.add_node("marketing_agent", marketing_agent_node)
    graph.add_node("analytics_agent", analytics_agent_node)

    graph.set_entry_point("supervisor")
    graph.add_conditional_edges(
        "supervisor", route_from_supervisor,
        {
            "inventory_agent": "inventory_agent",
            "order_agent": "order_agent",
            "support_agent": "support_agent",
            "pricing_agent": "pricing_agent",
            "logistics_agent": "logistics_agent",
            "marketing_agent": "marketing_agent",
            "analytics_agent": "analytics_agent",
        },
    )
    for agent in ["inventory_agent", "order_agent", "support_agent", "pricing_agent",
                  "logistics_agent", "marketing_agent", "analytics_agent"]:
        graph.add_edge(agent, END)
    return graph.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


# ── Agent Display Names ────────────────────────────────────────────────────────

_DISPLAY_NAMES = {
    "inventory_agent": "Inventory Agent",
    "order_agent": "Order Agent",
    "support_agent": "Support Agent",
    "pricing_agent": "Pricing Agent",
    "logistics_agent": "Logistics Agent",
    "marketing_agent": "Marketing Agent",
    "analytics_agent": "Analytics Agent",
}


# ── run_agent ──────────────────────────────────────────────────────────────────

def run_agent(trigger_event: str, payload: dict, user_message: str = "", user_id: int = None) -> dict:
    """Run a complete agent invocation through the LangGraph orchestrator."""
    trace_id = str(uuid.uuid4())
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    start_time = time.time()

    initial_state = AgentState(
        session_id=session_id,
        trace_id=trace_id,
        user_id=user_id,
        trigger_event=trigger_event,
        trigger_payload=payload or {},
        messages=[HumanMessage(content=user_message)] if user_message else [],
        active_agent="",
        agent_results={},
        action_proposals=[],
        executed_actions=[],
        requires_approval=False,
        approval_status=None,
        approver_id=None,
        final_response=None,
        error=None,
    )

    # Persist AgentExecution BEFORE running
    exec_id = None
    try:
        from app.db.session import engine
        from app.models import AgentExecution
        from sqlmodel import Session as DbSession
        with DbSession(engine) as db:
            execution = AgentExecution(
                trace_id=trace_id,
                session_id=session_id,
                agent_name="Orchestrator",
                trigger_event=trigger_event,
                input_payload=json.dumps(payload) if payload else None,
                status="RUNNING",
                started_at=datetime.now(timezone.utc),
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            exec_id = execution.id
    except Exception as e:
        logger.warning(f"Could not persist AgentExecution: {e}")

    try:
        graph = get_graph()
        result = graph.invoke(initial_state)
        agent_name = result.get("active_agent", "unknown")
        response = result.get("final_response", "")
        elapsed_ms = int((time.time() - start_time) * 1000)
        display_name = _DISPLAY_NAMES.get(agent_name, agent_name.replace("_", " ").title())

        # Update execution to COMPLETED
        if exec_id:
            try:
                from app.db.session import engine
                from app.models import AgentExecution
                from sqlmodel import Session as DbSession
                with DbSession(engine) as db:
                    row = db.get(AgentExecution, exec_id)
                    if row:
                        row.agent_name = display_name
                        row.status = "COMPLETED"
                        row.output_summary = response[:500] if response else ""
                        row.execution_time_ms = elapsed_ms
                        row.completed_at = datetime.now(timezone.utc)
                        db.add(row)
                        db.commit()
            except Exception as e:
                logger.warning(f"Could not update AgentExecution: {e}")

        return {
            "trace_id": trace_id,
            "agent": display_name,
            "response": response,
            "agent_results": result.get("agent_results", {}),
            "requires_approval": result.get("requires_approval", False),
        }

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.error(f"Agent execution failed: {e}", exc_info=True)

        if exec_id:
            try:
                from app.db.session import engine
                from app.models import AgentExecution
                from sqlmodel import Session as DbSession
                with DbSession(engine) as db:
                    row = db.get(AgentExecution, exec_id)
                    if row:
                        row.status = "FAILED"
                        row.error_message = str(e)[:500]
                        row.execution_time_ms = elapsed_ms
                        row.completed_at = datetime.now(timezone.utc)
                        db.add(row)
                        db.commit()
            except Exception:
                pass

        err = str(e)
        if "API_KEY" in err.upper() or "api key" in err.lower() or "INVALID_ARGUMENT" in err:
            friendly = "⚠️ AI agents are not configured. Please set a valid GEMINI_API_KEY in your .env file."
        elif "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err:
            friendly = "⚠️ AI quota exceeded. Please check your Gemini API usage limits."
        else:
            friendly = f"I encountered an issue processing your request. Please try again. ({err[:100]})"

        return {"trace_id": trace_id, "agent": "error", "response": friendly, "error": err}
