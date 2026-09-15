"""All e-commerce resource API routes."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user, require_ops, require_support
from app.models import User
from app.schemas import (
    ProductCreate, ProductUpdate, ProductRead,
    InventoryRead, InventoryUpdate, RestockRequest,
    OrderCreate, OrderRead, OrderStatusUpdate, OrderItemRead,
    ShipmentCreate, ShipmentRead, ShipmentStatusUpdate,
    TicketCreate, TicketRead, TicketStatusUpdate,
    ApprovalDecision, ApprovalRead,
    CustomerCreate, CustomerRead,
)
from app.services.ecommerce_service import (
    product_service, inventory_service, order_service,
    shipment_service, ticket_service, approvals_service,
)
from app.repositories import (
    customer_repo, audit_repo, execution_repo, approval_repo,
    order_repo, ticket_repo,
)

logger = logging.getLogger("shopmind.api.routes")
router = APIRouter(tags=["ecommerce"])


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "ShopMind API v1"}


# ── Customers ──────────────────────────────────────────────────────────────────

@router.get("/customers", response_model=List[CustomerRead])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return customer_repo.get_all(db, skip, limit)


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.models import Customer
    customer = Customer(**data.model_dump())
    return customer_repo.create(db, customer)


@router.get("/customers/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = customer_repo.get(db, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


# ── Products ───────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductRead])
def list_products(skip: int = Query(0, ge=0), limit: int = Query(100, le=500), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return product_service.list_products(db, skip, limit)


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return product_service.create(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = product_service.get(db, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.patch("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return product_service.update(db, product_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Inventory ──────────────────────────────────────────────────────────────────

@router.get("/inventory", response_model=List[InventoryRead])
def list_inventory(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return inventory_service.get_all(db)


@router.get("/inventory/low-stock", response_model=List[InventoryRead])
def get_low_stock(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return inventory_service.get_low_stock(db)


@router.get("/inventory/{product_id}", response_model=InventoryRead)
def get_inventory(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    inv = inventory_service.get_by_product(db, product_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return inv


@router.patch("/inventory/{product_id}", response_model=InventoryRead)
def update_inventory(product_id: int, data: InventoryUpdate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return inventory_service.update(db, product_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/inventory/restock")
def restock_inventory(req: RestockRequest, db: Session = Depends(get_db), user: User = Depends(require_ops)):
    try:
        return inventory_service.request_restock(db, req, actor=user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Orders ─────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[OrderRead])
def list_orders(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(100, le=500),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    customer_id = user.customer.id if user.role.name == "CUSTOMER" and user.customer else None
    return order_service.list_orders(db, status, skip, limit, customer_id=customer_id)


@router.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    try:
        return order_service.create_order(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = order_service.get(db, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.role.name == "CUSTOMER":
        if not user.customer or o.customer_id != user.customer.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    return o


@router.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return order_service.update_status(db, order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Shipments ──────────────────────────────────────────────────────────────────

@router.get("/shipments", response_model=List[ShipmentRead])
def list_shipments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return shipment_service.list_shipments(db)


@router.get("/shipments/delayed", response_model=List[ShipmentRead])
def get_delayed_shipments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return shipment_service.get_delayed(db)


@router.post("/shipments", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
def create_shipment(data: ShipmentCreate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return shipment_service.create(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/shipments/{shipment_id}/status")
def update_shipment_status(shipment_id: int, data: ShipmentStatusUpdate, db: Session = Depends(get_db), _: User = Depends(require_ops)):
    try:
        return shipment_service.update_status(db, shipment_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Support Tickets ────────────────────────────────────────────────────────────

@router.get("/support/tickets", response_model=List[TicketRead])
def list_tickets(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer_id = user.customer.id if user.role.name == "CUSTOMER" and user.customer else None
    return ticket_service.list_tickets(db, status, customer_id=customer_id)


@router.post("/support/tickets", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(data: TicketCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ticket_service.create(db, data)


@router.patch("/support/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: int, data: TicketStatusUpdate, db: Session = Depends(get_db), _: User = Depends(require_support)):
    try:
        return ticket_service.update_status(db, ticket_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Approvals ──────────────────────────────────────────────────────────────────

@router.get("/approvals/pending", response_model=List[ApprovalRead])
def get_pending_approvals(db: Session = Depends(get_db), _: User = Depends(require_ops)):
    return approvals_service.list_pending(db)


@router.post("/approvals/{approval_id}/decide")
def decide_approval(approval_id: int, data: ApprovalDecision, db: Session = Depends(get_db), user: User = Depends(require_ops)):
    try:
        return approvals_service.decide(db, approval_id, data, user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Agent Executions & Audit ───────────────────────────────────────────────────

@router.get("/agents/executions")
def list_executions(limit: int = Query(50, le=200), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    executions = execution_repo.get_recent(db, limit)
    return [
        {
            "id": e.id,
            "trace_id": e.trace_id,
            "agent_name": e.agent_name,
            "trigger_event": e.trigger_event,
            "status": e.status,
            "execution_time_ms": e.execution_time_ms,
            "started_at": e.started_at.isoformat(),
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in executions
    ]


@router.get("/audit/logs")
def get_audit_logs(limit: int = Query(100, le=500), db: Session = Depends(get_db), _: User = Depends(require_ops)):
    logs = audit_repo.get_recent(db, limit)
    return [
        {
            "id": log.id,
            "trace_id": log.trace_id,
            "timestamp": log.timestamp.isoformat(),
            "actor": log.actor,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "risk_level": log.risk_level,
            "result": log.result,
        }
        for log in logs
    ]


# ── Dashboard Analytics ────────────────────────────────────────────────────────

@router.get("/dashboard/metrics")
def dashboard_metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from datetime import timedelta
    from sqlmodel import select, func
    from app.models import AgentExecution, Order

    if user.role.name == "CUSTOMER":
        if not user.customer:
            return {"total_orders": 0, "pending_orders": 0, "open_support_tickets": 0}
        customer_id = user.customer.id
        my_orders = order_repo.get_by_customer(db, customer_id)
        pending = sum(1 for o in my_orders if o.status == "PENDING")
        my_tickets = ticket_repo.get_by_customer(db, customer_id)
        open_tix = sum(1 for t in my_tickets if t.status in ["OPEN", "IN_PROGRESS"])
        return {"total_orders": len(my_orders), "pending_orders": pending, "open_support_tickets": open_tix, "is_customer": True}

    # Business-wide metrics
    from app.repositories import shipment_repo, inventory_repo
    total_orders = db.exec(select(func.count(Order.id))).one() or 0
    pending_orders = order_repo.count_by_status(db, "PENDING")
    low_stock = len(inventory_repo.get_low_stock(db))
    delayed_shipments = len(shipment_repo.get_delayed(db))
    open_tickets = ticket_repo.count_open(db)
    pending_approvals = len(approval_repo.get_pending(db))
    recent_executions = execution_repo.get_recent(db, limit=8)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timezone
    agent_actions_today = db.exec(
        select(func.count(AgentExecution.id)).where(
            AgentExecution.status == "COMPLETED",
            AgentExecution.started_at >= today_start,
        )
    ).one() or 0

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "low_stock_products": low_stock,
        "delayed_shipments": delayed_shipments,
        "open_support_tickets": open_tickets,
        "pending_approvals": pending_approvals,
        "agent_actions_today": agent_actions_today,
        "recent_agent_activity": [
            {"agent": e.agent_name, "event": e.trigger_event, "status": e.status, "started_at": e.started_at.isoformat()}
            for e in recent_executions
        ],
    }


# ── Demand Forecast ────────────────────────────────────────────────────────────

@router.get("/forecast/{product_id}")
def get_demand_forecast(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.ml.forecaster import demand_forecaster
    try:
        return demand_forecaster.forecast(db, product_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
