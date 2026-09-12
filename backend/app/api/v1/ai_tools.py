"""AI Enhancement Tools — Report Generator, Sentiment Analysis, Product Description."""
import logging
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.dependencies import get_db, get_current_user, require_ops
from app.models import User, Order, OrderItem, Product, Inventory, SupportTicket, OrderStatus
from app.core.config import settings

logger = logging.getLogger("shopmind.api.ai_tools")
router = APIRouter(prefix="/ai-tools", tags=["ai_tools"])


# ── Gemini helper ─────────────────────────────────────────────────────────────

def _gemini_generate(prompt: str, temperature: float = 0.7) -> str:
    try:
        from google import genai as _genai
        client = _genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        content = response.candidates[0].content.parts[0]
        if hasattr(content, "text"):
            return content.text
        if isinstance(content, dict):
            return content.get("text", str(content))
        return str(content)
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise HTTPException(500, f"AI generation failed: {e}")


# ── 1. AI Report Generator ────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    period: str = "weekly"  # weekly | monthly
    focus: Optional[str] = None  # optional focus area


@router.post("/report")
def generate_report(payload: ReportRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Generate an AI-written business summary report using live data."""

    # Collect live metrics
    orders = db.exec(select(Order).where(Order.status != OrderStatus.CANCELLED)).all()
    total_revenue = sum(o.total for o in orders)
    total_orders = len(orders)
    aov = total_revenue / total_orders if total_orders else 0

    # Top categories
    cat_rows = db.exec(
        select(Product.category, func.sum(OrderItem.unit_price * OrderItem.quantity).label("rev"))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status != OrderStatus.CANCELLED)
        .group_by(Product.category)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(3)
    ).all()
    top_cats = ", ".join(f"{r[0]} (₹{r[1]:,.0f})" for r in cat_rows) if cat_rows else "N/A"

    # Low stock
    low_stock = db.exec(
        select(Product, Inventory)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(Inventory.current_stock <= Inventory.reorder_threshold)
        .limit(5)
    ).all()
    low_stock_names = ", ".join(p.name for p, _ in low_stock) if low_stock else "None"

    # Open tickets
    open_tickets = db.exec(select(func.count(SupportTicket.id)).where(SupportTicket.status == "OPEN")).one() or 0

    prompt = f"""You are a senior e-commerce business analyst. Write a concise {payload.period} business intelligence report for ShopMind, an AI-powered e-commerce platform.

LIVE DATA:
- Total Revenue: ₹{total_revenue:,.2f}
- Total Orders: {total_orders}
- Average Order Value: ₹{aov:,.2f}
- Top Categories: {top_cats}
- Low Stock Products: {low_stock_names}
- Open Support Tickets: {open_tickets}
- Report Period: {payload.period.title()}
{f'- Focus Area: {payload.focus}' if payload.focus else ''}

Write a structured report with these sections:
1. **Executive Summary** (2-3 sentences)
2. **Revenue Performance** (analysis + trend)
3. **Inventory Health** (stock status + risks)
4. **Customer Support** (ticket insights)
5. **Key Recommendations** (3 actionable points)

Use markdown formatting with bold headers. Be specific with numbers. Keep it professional and under 400 words."""

    report_text = _gemini_generate(prompt, temperature=0.5)

    return {
        "period": payload.period,
        "generated_at": datetime.utcnow().isoformat(),
        "metrics_snapshot": {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "aov": round(aov, 2),
            "low_stock_count": len(low_stock),
            "open_tickets": open_tickets,
        },
        "report": report_text,
    }


# ── 2. Sentiment Analysis ─────────────────────────────────────────────────────

@router.post("/sentiment/{ticket_id}")
def analyze_ticket_sentiment(ticket_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Analyze customer sentiment for a single support ticket."""
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    prompt = f"""Analyze the sentiment and urgency of this customer support ticket.

Subject: {ticket.subject}
Description: {ticket.description}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{{
  "sentiment": "POSITIVE" or "NEUTRAL" or "NEGATIVE" or "ANGRY",
  "score": <float between -1.0 (very negative) and 1.0 (very positive)>,
  "urgency": "LOW" or "MEDIUM" or "HIGH" or "CRITICAL",
  "emotion": <one word describing the dominant emotion, e.g. "frustrated", "confused", "satisfied">,
  "summary": <one sentence summarizing the customer's issue and feeling>,
  "suggested_priority": "LOW" or "MEDIUM" or "HIGH" or "URGENT"
}}"""

    raw = _gemini_generate(prompt, temperature=0.2)
    try:
        # Strip markdown code fences if present
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(clean)
    except Exception:
        result = {"sentiment": "NEUTRAL", "score": 0.0, "urgency": "MEDIUM", "emotion": "unknown", "summary": raw[:200], "suggested_priority": "MEDIUM"}

    return {"ticket_id": ticket_id, "subject": ticket.subject, **result}


@router.post("/bulk-sentiment")
def bulk_sentiment(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Analyze sentiment for all OPEN support tickets."""
    tickets = db.exec(select(SupportTicket).where(SupportTicket.status == "OPEN").limit(20)).all()
    if not tickets:
        return {"results": [], "summary": {"total": 0}}

    prompt = f"""Analyze sentiment for these {len(tickets)} support tickets. Respond ONLY with a JSON array.

Tickets:
{chr(10).join(f'{i+1}. Subject: "{t.subject}" | Description: "{t.description[:150]}"' for i, t in enumerate(tickets))}

Return a JSON array (no markdown) with one object per ticket:
[{{"ticket_index": 1, "sentiment": "POSITIVE|NEUTRAL|NEGATIVE|ANGRY", "score": 0.0, "urgency": "LOW|MEDIUM|HIGH|CRITICAL", "emotion": "word"}}]"""

    raw = _gemini_generate(prompt, temperature=0.1)
    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        items = json.loads(clean)
    except Exception:
        items = [{"ticket_index": i + 1, "sentiment": "NEUTRAL", "score": 0.0, "urgency": "MEDIUM", "emotion": "unknown"} for i in range(len(tickets))]

    results = []
    for i, ticket in enumerate(tickets):
        item = next((x for x in items if x.get("ticket_index") == i + 1), {})
        results.append({
            "ticket_id": ticket.id,
            "subject": ticket.subject,
            "sentiment": item.get("sentiment", "NEUTRAL"),
            "score": item.get("score", 0.0),
            "urgency": item.get("urgency", "MEDIUM"),
            "emotion": item.get("emotion", "unknown"),
        })

    sentiment_counts = {}
    for r in results:
        s = r["sentiment"]
        sentiment_counts[s] = sentiment_counts.get(s, 0) + 1

    return {
        "results": results,
        "summary": {
            "total": len(results),
            "sentiment_breakdown": sentiment_counts,
            "critical_count": sum(1 for r in results if r["urgency"] == "CRITICAL"),
            "avg_score": round(sum(r["score"] for r in results) / len(results), 2) if results else 0,
        },
    }


# ── 3. Product Description Generator ─────────────────────────────────────────

class DescriptionRequest(BaseModel):
    product_name: str
    category: str
    sku: Optional[str] = None
    key_features: Optional[str] = None
    target_audience: Optional[str] = None
    tone: str = "professional"  # professional | friendly | luxury | technical


@router.post("/generate-description")
def generate_description(payload: DescriptionRequest, _: User = Depends(get_current_user)):
    """Generate SEO-optimized product description using Gemini."""
    prompt = f"""You are an expert e-commerce copywriter. Write a compelling, SEO-optimized product description.

Product Details:
- Name: {payload.product_name}
- Category: {payload.category}
- SKU: {payload.sku or 'N/A'}
- Key Features: {payload.key_features or 'Not specified'}
- Target Audience: {payload.target_audience or 'General consumers'}
- Tone: {payload.tone}

Write the following (use markdown):
**Short Description** (1-2 sentences, for product cards):
<text here>

**Full Description** (3-4 paragraphs with benefits, features, use cases):
<text here>

**Key Features** (bullet points, 5-6 items):
<bullet list>

**SEO Keywords** (8-10 relevant keywords, comma-separated):
<keywords>

Make it compelling, benefit-focused, and naturally include search-friendly language."""

    text = _gemini_generate(prompt, temperature=0.8)

    return {
        "product_name": payload.product_name,
        "category": payload.category,
        "tone": payload.tone,
        "generated_at": datetime.utcnow().isoformat(),
        "description": text,
    }


@router.post("/generate-description/{product_id}")
def generate_description_from_db(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Generate product description directly from a product in the database."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    payload = DescriptionRequest(
        product_name=product.name,
        category=product.category,
        sku=product.sku,
        key_features=product.description[:200] if product.description else None,
    )
    result = generate_description(payload, _)
    result["product_id"] = product_id
    return result
