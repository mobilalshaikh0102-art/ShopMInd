"""Customer CRM API — profiles, RFM scoring, segmentation, notes."""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.dependencies import get_db, get_current_user, require_ops
from app.models import Customer, Order, OrderItem, SupportTicket, OrderStatus, User

logger = logging.getLogger("shopmind.api.crm")
router = APIRouter(prefix="/crm", tags=["crm"])

# In-memory CRM notes store (keyed by customer_id)
_CRM_NOTES: dict[int, list] = {}


# ── RFM Scoring ───────────────────────────────────────────────────────────────

def _compute_rfm(customer: Customer, orders: list) -> dict:
    """Compute Recency, Frequency, Monetary score for a customer."""
    now = datetime.utcnow()
    completed = [o for o in orders if o.status not in (OrderStatus.CANCELLED, "CANCELLED")]

    if not completed:
        return {"recency_days": None, "frequency": 0, "monetary": 0.0,
                "rfm_score": 0, "segment": "NEW", "churn_risk": "LOW"}

    most_recent = max(o.created_at for o in completed)
    # Handle timezone-aware datetimes
    if most_recent.tzinfo:
        most_recent = most_recent.replace(tzinfo=None)

    recency_days = (now - most_recent).days
    frequency = len(completed)
    monetary = sum(o.total for o in completed)

    # Score each dimension 1-5
    r_score = 5 if recency_days <= 30 else 4 if recency_days <= 60 else 3 if recency_days <= 90 else 2 if recency_days <= 180 else 1
    f_score = 5 if frequency >= 10 else 4 if frequency >= 6 else 3 if frequency >= 3 else 2 if frequency >= 2 else 1
    m_score = 5 if monetary >= 50000 else 4 if monetary >= 20000 else 3 if monetary >= 10000 else 2 if monetary >= 2000 else 1

    rfm_score = r_score * 100 + f_score * 10 + m_score

    # Segmentation
    if r_score >= 4 and f_score >= 4 and m_score >= 4:
        segment = "VIP"
    elif r_score <= 2 and f_score <= 2:
        segment = "AT_RISK"
    elif recency_days <= 60 and frequency <= 2:
        segment = "NEW"
    else:
        segment = "REGULAR"

    churn_risk = "HIGH" if recency_days > 90 and frequency < 3 else "MEDIUM" if recency_days > 60 else "LOW"

    return {
        "recency_days": recency_days,
        "frequency": frequency,
        "monetary": round(monetary, 2),
        "r_score": r_score,
        "f_score": f_score,
        "m_score": m_score,
        "rfm_score": rfm_score,
        "segment": segment,
        "churn_risk": churn_risk,
    }


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
def crm_overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """High-level CRM metrics."""
    customers = db.exec(select(Customer)).all()
    total_customers = len(customers)

    # Revenue per customer
    order_rows = db.exec(
        select(Order.customer_id, func.sum(Order.total).label("total"), func.count(Order.id).label("cnt"))
        .where(Order.status != OrderStatus.CANCELLED)
        .group_by(Order.customer_id)
    ).all()
    revenue_map = {r[0]: (r[1], r[2]) for r in order_rows}

    total_revenue = sum(v[0] for v in revenue_map.values())
    avg_clv = total_revenue / total_customers if total_customers else 0

    # Count segments (simplified without per-customer RFM for speed)
    vip_count = sum(1 for cid, (rev, cnt) in revenue_map.items() if rev >= 20000 and cnt >= 4)
    at_risk_count = sum(1 for cid in revenue_map if revenue_map[cid][1] < 2)
    new_count = total_customers - len(revenue_map)

    # Open tickets
    open_tickets = db.exec(select(func.count(SupportTicket.id)).where(SupportTicket.status == "OPEN")).one() or 0

    return {
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "avg_customer_lifetime_value": round(avg_clv, 2),
        "vip_count": vip_count,
        "at_risk_count": at_risk_count,
        "new_count": new_count,
        "regular_count": max(0, total_customers - vip_count - at_risk_count - new_count),
        "open_tickets": open_tickets,
        "repeat_purchase_rate": round(sum(1 for _, (_, cnt) in revenue_map.items() if cnt > 1) / total_customers * 100, 1) if total_customers else 0,
    }


# ── Customer List ─────────────────────────────────────────────────────────────

@router.get("/customers")
def list_customers(
    search: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Customer)
    if search:
        q = f"%{search}%"
        query = query.where(
            (Customer.name.ilike(q)) | (Customer.email.ilike(q)) | (Customer.phone.ilike(q))
        )
    customers = db.exec(query.order_by(Customer.created_at.desc())).all()

    # Enrich with order stats
    results = []
    for c in customers:
        orders = db.exec(select(Order).where(Order.customer_id == c.id)).all()
        rfm = _compute_rfm(c, orders)
        # Filter by segment
        if segment and segment != "ALL" and rfm["segment"] != segment:
            continue
        ticket_count = db.exec(select(func.count(SupportTicket.id)).where(SupportTicket.customer_id == c.id)).one() or 0
        results.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "city": c.city,
            "country": c.country,
            "created_at": c.created_at.isoformat(),
            "order_count": rfm["frequency"],
            "lifetime_value": rfm["monetary"],
            "segment": rfm["segment"],
            "churn_risk": rfm["churn_risk"],
            "rfm_score": rfm["rfm_score"],
            "recency_days": rfm["recency_days"],
            "ticket_count": ticket_count,
            "notes_count": len(_CRM_NOTES.get(c.id, [])),
        })

    total = len(results)
    start = (page - 1) * limit
    paginated = results[start: start + limit]

    return {"total": total, "page": page, "limit": limit, "customers": paginated}


# ── Customer Profile ──────────────────────────────────────────────────────────

@router.get("/customers/{customer_id}")
def customer_profile(customer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    customer = db.get(Customer, customer_id)
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(404, "Customer not found")

    orders = db.exec(select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc())).all()
    tickets = db.exec(select(SupportTicket).where(SupportTicket.customer_id == customer_id).order_by(SupportTicket.created_at.desc())).all()
    rfm = _compute_rfm(customer, orders)

    # Order items for top products
    top_products: dict = {}
    for order in orders[:20]:
        items = db.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        for item in items:
            top_products[item.product_id] = top_products.get(item.product_id, 0) + item.quantity

    sorted_products = sorted(top_products.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "city": customer.city,
        "state": customer.state,
        "country": customer.country,
        "pincode": customer.pincode,
        "created_at": customer.created_at.isoformat(),
        "rfm": rfm,
        "orders": [{"id": o.id, "order_number": o.order_number, "status": o.status, "total": o.total, "created_at": o.created_at.isoformat()} for o in orders[:10]],
        "tickets": [{"id": t.id, "subject": t.subject, "status": t.status, "priority": t.priority, "created_at": t.created_at.isoformat()} for t in tickets[:5]],
        "top_products": sorted_products,
        "notes": _CRM_NOTES.get(customer_id, []),
    }


# ── CRM Notes ─────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    text: str


@router.post("/customers/{customer_id}/notes")
def add_note(customer_id: int, payload: NoteCreate, current_user: User = Depends(get_current_user)):
    note = {
        "id": len(_CRM_NOTES.get(customer_id, [])) + 1,
        "text": payload.text,
        "author": current_user.full_name,
        "created_at": datetime.utcnow().isoformat(),
    }
    _CRM_NOTES.setdefault(customer_id, []).append(note)
    return note


# ── Segments ──────────────────────────────────────────────────────────────────

@router.get("/segments")
def segment_counts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    customers = db.exec(select(Customer)).all()
    counts = {"ALL": len(customers), "VIP": 0, "REGULAR": 0, "AT_RISK": 0, "NEW": 0}

    for c in customers:
        orders = db.exec(select(Order).where(Order.customer_id == c.id)).all()
        rfm = _compute_rfm(c, orders)
        seg = rfm.get("segment", "NEW")
        counts[seg] = counts.get(seg, 0) + 1

    return counts
