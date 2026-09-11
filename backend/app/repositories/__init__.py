"""Repository pattern — CRUD helpers for all models."""
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Type, TypeVar

from sqlmodel import Session, select

from app.models import (
    Customer, Product, Inventory, Order, OrderItem,
    Shipment, SupportTicket, Approval, ApprovalStatus,
    AgentExecution, AgentAction, AuditLog, KnowledgeDocument,
    OrderStatus, ShipmentStatus, TicketStatus,
)

logger = logging.getLogger("shopmind.repositories")
T = TypeVar("T")


# ── Generic ────────────────────────────────────────────────────────────────────

def _get(db: Session, model: Type[T], id: int) -> Optional[T]:
    return db.get(model, id)


def _get_all(db: Session, model: Type[T], skip: int = 0, limit: int = 100) -> List[T]:
    return list(db.exec(select(model).offset(skip).limit(limit)).all())


def _create(db: Session, obj: T) -> T:
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _update(db: Session, obj: T) -> T:
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ── Customer Repo ──────────────────────────────────────────────────────────────

class CustomerRepository:
    def get(self, db: Session, id: int) -> Optional[Customer]:
        return _get(db, Customer, id)

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Customer]:
        return _get_all(db, Customer, skip, limit)

    def get_by_email(self, db: Session, email: str) -> Optional[Customer]:
        return db.exec(select(Customer).where(Customer.email == email)).first()

    def create(self, db: Session, customer: Customer) -> Customer:
        return _create(db, customer)

    def get_by_user(self, db: Session, user_id: int) -> Optional[Customer]:
        return db.exec(select(Customer).where(Customer.user_id == user_id)).first()


# ── Product Repo ───────────────────────────────────────────────────────────────

class ProductRepository:
    def get(self, db: Session, id: int) -> Optional[Product]:
        return _get(db, Product, id)

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Product]:
        return list(db.exec(select(Product).where(Product.is_active == True).offset(skip).limit(limit)).all())

    def get_by_sku(self, db: Session, sku: str) -> Optional[Product]:
        return db.exec(select(Product).where(Product.sku == sku)).first()

    def create(self, db: Session, product: Product) -> Product:
        return _create(db, product)

    def update(self, db: Session, product: Product) -> Product:
        return _update(db, product)

    def get_by_category(self, db: Session, category: str) -> List[Product]:
        return list(db.exec(select(Product).where(Product.category == category, Product.is_active == True)).all())


# ── Inventory Repo ─────────────────────────────────────────────────────────────

class InventoryRepository:
    def get_all(self, db: Session) -> List[Inventory]:
        return list(db.exec(select(Inventory)).all())

    def get_by_product(self, db: Session, product_id: int) -> Optional[Inventory]:
        return db.exec(select(Inventory).where(Inventory.product_id == product_id)).first()

    def get_low_stock(self, db: Session) -> List[Inventory]:
        invs = self.get_all(db)
        return [i for i in invs if i.current_stock <= i.reorder_threshold]

    def create(self, db: Session, inv: Inventory) -> Inventory:
        return _create(db, inv)

    def update(self, db: Session, inv: Inventory) -> Inventory:
        inv.updated_at = datetime.now(timezone.utc)
        return _update(db, inv)


# ── Order Repo ─────────────────────────────────────────────────────────────────

class OrderRepository:
    def get(self, db: Session, id: int) -> Optional[Order]:
        return _get(db, Order, id)

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Order]:
        return list(db.exec(select(Order).order_by(Order.created_at.desc()).offset(skip).limit(limit)).all())

    def get_by_status(self, db: Session, status: str) -> List[Order]:
        return list(db.exec(select(Order).where(Order.status == status)).all())

    def get_by_customer(self, db: Session, customer_id: int) -> List[Order]:
        return list(db.exec(select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc())).all())

    def get_by_order_number(self, db: Session, order_number: str) -> Optional[Order]:
        return db.exec(select(Order).where(Order.order_number == order_number)).first()

    def create(self, db: Session, order: Order) -> Order:
        return _create(db, order)

    def update(self, db: Session, order: Order) -> Order:
        order.updated_at = datetime.now(timezone.utc)
        return _update(db, order)

    def count_by_status(self, db: Session, status: str) -> int:
        from sqlmodel import func
        return db.exec(select(func.count(Order.id)).where(Order.status == status)).one() or 0


# ── Shipment Repo ──────────────────────────────────────────────────────────────

class ShipmentRepository:
    def get(self, db: Session, id: int) -> Optional[Shipment]:
        return _get(db, Shipment, id)

    def get_all(self, db: Session) -> List[Shipment]:
        return list(db.exec(select(Shipment).order_by(Shipment.created_at.desc())).all())

    def get_delayed(self, db: Session) -> List[Shipment]:
        return list(db.exec(select(Shipment).where(Shipment.status == ShipmentStatus.DELAYED)).all())

    def get_by_order(self, db: Session, order_id: int) -> List[Shipment]:
        return list(db.exec(select(Shipment).where(Shipment.order_id == order_id)).all())

    def create(self, db: Session, shipment: Shipment) -> Shipment:
        return _create(db, shipment)

    def update(self, db: Session, shipment: Shipment) -> Shipment:
        shipment.updated_at = datetime.now(timezone.utc)
        return _update(db, shipment)


# ── Ticket Repo ────────────────────────────────────────────────────────────────

class TicketRepository:
    def get(self, db: Session, id: int) -> Optional[SupportTicket]:
        return _get(db, SupportTicket, id)

    def get_all(self, db: Session, status: Optional[str] = None, customer_id: Optional[int] = None) -> List[SupportTicket]:
        stmt = select(SupportTicket)
        if status:
            stmt = stmt.where(SupportTicket.status == status)
        if customer_id:
            stmt = stmt.where(SupportTicket.customer_id == customer_id)
        return list(db.exec(stmt.order_by(SupportTicket.created_at.desc())).all())

    def get_by_customer(self, db: Session, customer_id: int) -> List[SupportTicket]:
        return list(db.exec(select(SupportTicket).where(SupportTicket.customer_id == customer_id)).all())

    def count_open(self, db: Session) -> int:
        tickets = self.get_all(db)
        return sum(1 for t in tickets if t.status in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS])

    def create(self, db: Session, ticket: SupportTicket) -> SupportTicket:
        return _create(db, ticket)

    def update(self, db: Session, ticket: SupportTicket) -> SupportTicket:
        ticket.updated_at = datetime.now(timezone.utc)
        return _update(db, ticket)


# ── Approval Repo ──────────────────────────────────────────────────────────────

class ApprovalRepository:
    def get(self, db: Session, id: int) -> Optional[Approval]:
        return _get(db, Approval, id)

    def get_pending(self, db: Session) -> List[Approval]:
        return list(db.exec(select(Approval).where(Approval.status == ApprovalStatus.PENDING)).all())

    def create(self, db: Session, approval: Approval) -> Approval:
        return _create(db, approval)

    def update(self, db: Session, approval: Approval) -> Approval:
        return _update(db, approval)


# ── Execution Repo ─────────────────────────────────────────────────────────────

class ExecutionRepository:
    def get_recent(self, db: Session, limit: int = 50) -> List[AgentExecution]:
        return list(db.exec(select(AgentExecution).order_by(AgentExecution.started_at.desc()).limit(limit)).all())

    def create(self, db: Session, execution: AgentExecution) -> AgentExecution:
        return _create(db, execution)

    def update(self, db: Session, execution: AgentExecution) -> AgentExecution:
        return _update(db, execution)


# ── Audit Repo ─────────────────────────────────────────────────────────────────

class AuditRepository:
    def get_recent(self, db: Session, limit: int = 100) -> List[AuditLog]:
        return list(db.exec(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)).all())

    def create(self, db: Session, log: AuditLog) -> AuditLog:
        return _create(db, log)

    def log_action(
        self, db: Session, actor: str, action: str,
        entity_type: str = None, entity_id: int = None,
        risk_level: str = "LOW", result: str = "success",
        trace_id: str = None, metadata: dict = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            risk_level=risk_level,
            result=result,
            trace_id=trace_id,
            metadata=json.dumps(metadata) if metadata else None,
        )
        return self.create(db, entry)


# ── Knowledge Repo ─────────────────────────────────────────────────────────────

class KnowledgeRepository:
    def get_all(self, db: Session) -> List[KnowledgeDocument]:
        return list(db.exec(select(KnowledgeDocument)).all())

    def create(self, db: Session, doc: KnowledgeDocument) -> KnowledgeDocument:
        return _create(db, doc)

    def get_by_category(self, db: Session, category: str) -> List[KnowledgeDocument]:
        return list(db.exec(select(KnowledgeDocument).where(KnowledgeDocument.category == category)).all())


# ── Singletons ──────────────────────────────────────────────────────────────────

customer_repo = CustomerRepository()
product_repo = ProductRepository()
inventory_repo = InventoryRepository()
order_repo = OrderRepository()
shipment_repo = ShipmentRepository()
ticket_repo = TicketRepository()
approval_repo = ApprovalRepository()
execution_repo = ExecutionRepository()
audit_repo = AuditRepository()
knowledge_repo = KnowledgeRepository()
