"""Security & Compliance API — sessions, password change, audit, user management, GDPR export."""
import logging
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.dependencies import get_db, get_current_user, require_admin
from app.core.security import verify_password, hash_password, create_access_token
from app.models import User, Role, AuditLog

logger = logging.getLogger("shopmind.api.security")
router = APIRouter(prefix="/security", tags=["security"])

# ── In-memory session registry ─────────────────────────────────────────────────
# Maps jti → {user_id, email, ip, user_agent, created_at, last_active}
_SESSIONS: dict[str, dict] = {}


def register_session(jti: str, user: User, ip: str, user_agent: str):
    _SESSIONS[jti] = {
        "jti": jti,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "ip": ip,
        "user_agent": user_agent[:80] if user_agent else "Unknown",
        "created_at": datetime.utcnow().isoformat(),
        "last_active": datetime.utcnow().isoformat(),
        "is_current": False,
    }


def get_user_sessions(user_id: int) -> list:
    return [s for s in _SESSIONS.values() if s["user_id"] == user_id]


def revoke_session(jti: str):
    _SESSIONS.pop(jti, None)


# ── In-memory security event log ─────────────────────────────────────────────
_SEC_EVENTS: list = [
    {"id": 1, "type": "LOGIN_SUCCESS", "email": "admin@shopmind.ai", "ip": "127.0.0.1", "ts": "2026-09-12T08:12:00", "detail": "Admin login"},
    {"id": 2, "type": "LOGIN_SUCCESS", "email": "ops@shopmind.ai", "ip": "192.168.1.10", "ts": "2026-09-12T09:05:00", "detail": "OPS login"},
    {"id": 3, "type": "LOGIN_FAILED", "email": "unknown@hacker.com", "ip": "45.33.32.156", "ts": "2026-09-12T10:44:00", "detail": "Invalid credentials"},
    {"id": 4, "type": "PASSWORD_CHANGED", "email": "admin@shopmind.ai", "ip": "127.0.0.1", "ts": "2026-09-12T11:00:00", "detail": "Password updated"},
    {"id": 5, "type": "SESSION_REVOKED", "email": "ops@shopmind.ai", "ip": "127.0.0.1", "ts": "2026-09-12T14:30:00", "detail": "Session revoked by user"},
    {"id": 6, "type": "PERMISSION_DENIED", "email": "customer@test.com", "ip": "10.0.0.5", "ts": "2026-09-12T15:12:00", "detail": "Attempted admin route"},
]
_SEC_EVENT_SEQ = 7


def _log_event(event_type: str, email: str, ip: str, detail: str):
    global _SEC_EVENT_SEQ
    _SEC_EVENTS.insert(0, {
        "id": _SEC_EVENT_SEQ,
        "type": event_type,
        "email": email,
        "ip": ip,
        "ts": datetime.utcnow().isoformat(),
        "detail": detail,
    })
    _SEC_EVENT_SEQ += 1
    # Keep max 100 events
    if len(_SEC_EVENTS) > 100:
        _SEC_EVENTS.pop()


# ── Session Management ────────────────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(request: Request, current_user: User = Depends(get_current_user)):
    """Return all active sessions for the current user."""
    sessions = get_user_sessions(current_user.id)
    # If no registered sessions (server restarted), return a demo current session
    if not sessions:
        sessions = [{
            "jti": "current-session",
            "user_id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "ip": request.client.host if request.client else "127.0.0.1",
            "user_agent": request.headers.get("user-agent", "Unknown")[:80],
            "created_at": datetime.utcnow().isoformat(),
            "last_active": datetime.utcnow().isoformat(),
            "is_current": True,
        }]
    else:
        # Mark most recent as current
        if sessions:
            sessions[-1]["is_current"] = True
    return sessions


@router.delete("/sessions/{jti}")
def revoke_session_endpoint(jti: str, request: Request, current_user: User = Depends(get_current_user)):
    session = _SESSIONS.get(jti)
    if not session or session["user_id"] != current_user.id:
        raise HTTPException(404, "Session not found")
    revoke_session(jti)
    _log_event("SESSION_REVOKED", current_user.email, request.client.host if request.client else "?", f"Session {jti[:8]}… revoked")
    return {"ok": True, "message": "Session revoked"}


@router.delete("/sessions")
def revoke_all_sessions(request: Request, current_user: User = Depends(get_current_user)):
    """Revoke all sessions except the current one."""
    sessions = get_user_sessions(current_user.id)
    count = 0
    for s in sessions:
        if not s.get("is_current"):
            revoke_session(s["jti"])
            count += 1
    _log_event("ALL_SESSIONS_REVOKED", current_user.email, request.client.host if request.client else "?", f"{count} sessions revoked")
    return {"ok": True, "revoked": count}


# ── Password Change ───────────────────────────────────────────────────────────

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        _log_event("PASSWORD_CHANGE_FAILED", current_user.email, request.client.host if request.client else "?", "Wrong current password")
        raise HTTPException(400, "Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    _log_event("PASSWORD_CHANGED", current_user.email, request.client.host if request.client else "?", "Password changed successfully")
    return {"ok": True, "message": "Password changed successfully"}


# ── Audit / Security Events ───────────────────────────────────────────────────

@router.get("/audit-events")
def get_security_events(
    limit: int = 50,
    event_type: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    events = _SEC_EVENTS
    if event_type:
        events = [e for e in events if e["type"] == event_type]
    return {
        "events": events[:limit],
        "total": len(events),
        "types": list({e["type"] for e in _SEC_EVENTS}),
    }


# ── GDPR Data Export ──────────────────────────────────────────────────────────

@router.get("/export-data")
def export_my_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """GDPR-compliant self-export of all user data."""
    from app.models import Customer, Order, OrderItem, SupportTicket
    from sqlmodel import select

    # Find customer linked to this user
    customer = db.exec(select(Customer).where(Customer.user_id == current_user.id)).first()
    orders = []
    tickets = []
    if customer:
        raw_orders = db.exec(select(Order).where(Order.customer_id == customer.id)).all()
        for o in raw_orders:
            items = db.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()
            orders.append({
                "order_number": o.order_number,
                "status": o.status,
                "total": o.total,
                "created_at": o.created_at.isoformat(),
                "items": [{"product_id": i.product_id, "qty": i.quantity, "price": i.unit_price} for i in items],
            })
        raw_tickets = db.exec(select(SupportTicket).where(SupportTicket.customer_id == customer.id)).all()
        tickets = [{"id": t.id, "subject": t.subject, "status": t.status, "created_at": t.created_at.isoformat()} for t in raw_tickets]

    return {
        "export_generated_at": datetime.utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "created_at": current_user.created_at.isoformat(),
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        },
        "customer_profile": {
            "name": customer.name if customer else None,
            "phone": customer.phone if customer else None,
            "address": customer.address if customer else None,
            "city": customer.city if customer else None,
            "country": customer.country if customer else None,
        } if customer else None,
        "orders": orders,
        "support_tickets": tickets,
        "data_retention_policy": "ShopMind retains user data for 7 years for legal compliance. Request deletion at privacy@shopmind.ai",
    }


# ── User Management (Admin only) ──────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role_name: str = "ANALYST"


class UserStatusUpdate(BaseModel):
    is_active: bool


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.exec(select(User)).all()
    result = []
    for u in users:
        role = db.get(Role, u.role_id)
        result.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": role.name if role else "UNKNOWN",
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None,
        })
    return result


@router.post("/users", status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    role = db.exec(select(Role).where(Role.name == payload.role_name)).first()
    if not role:
        raise HTTPException(404, f"Role '{payload.role_name}' not found")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": role.name}


@router.patch("/users/{user_id}/status")
def update_user_status(user_id: int, payload: UserStatusUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    return {"ok": True, "user_id": user_id, "is_active": payload.is_active}
