"""ShopMind — All SQLModel database models."""
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column
from sqlmodel import Field, Relationship, SQLModel


# ── Enums ──────────────────────────────────────────────────────────────────────

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class ShipmentStatus(str, Enum):
    PENDING = "PENDING"
    IN_TRANSIT = "IN_TRANSIT"
    DELAYED = "DELAYED"
    DELIVERED = "DELIVERED"
    RETURNED = "RETURNED"
    LOST = "LOST"


class TicketPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TicketStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentMethod(str, Enum):
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    UPI = "UPI"
    WALLET = "WALLET"
    COD = "COD"


# ── Role ───────────────────────────────────────────────────────────────────────

class Role(SQLModel, table=True):
    __tablename__ = "roles"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=50)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    users: List["User"] = Relationship(back_populates="role")


# ── User ───────────────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    full_name: str = Field(max_length=255)
    hashed_password: str
    role_id: int = Field(foreign_key="roles.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = Field(default=None)

    role: Optional[Role] = Relationship(back_populates="users")
    customer: Optional["Customer"] = Relationship(back_populates="user")


# ── Customer ───────────────────────────────────────────────────────────────────

class Customer(SQLModel, table=True):
    __tablename__ = "customers"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    name: str = Field(max_length=255)
    email: str = Field(unique=True, index=True, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: str = Field(default="India", max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    user: Optional[User] = Relationship(back_populates="customer")
    orders: List["Order"] = Relationship(back_populates="customer")
    support_tickets: List["SupportTicket"] = Relationship(back_populates="customer")


# ── Product ────────────────────────────────────────────────────────────────────

class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=255, index=True)
    category: str = Field(max_length=100, index=True)
    description: Optional[str] = Field(default=None)
    price: float = Field(gt=0)
    cost_price: float = Field(gt=0)
    currency: str = Field(default="INR", max_length=10)
    brand: Optional[str] = Field(default=None, max_length=100)
    weight_kg: Optional[float] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    inventory: Optional["Inventory"] = Relationship(back_populates="product")
    order_items: List["OrderItem"] = Relationship(back_populates="product")


# ── Inventory ──────────────────────────────────────────────────────────────────

class Inventory(SQLModel, table=True):
    __tablename__ = "inventory"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", unique=True, index=True)
    current_stock: int = Field(default=0, ge=0)
    reserved_stock: int = Field(default=0, ge=0)
    reorder_threshold: int = Field(default=10)
    reorder_quantity: int = Field(default=50)
    sales_velocity_30d: float = Field(default=0.0)
    last_restocked_at: Optional[datetime] = Field(default=None)
    warehouse_location: Optional[str] = Field(default=None, max_length=100)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    product: Optional[Product] = Relationship(back_populates="inventory")


# ── Order ──────────────────────────────────────────────────────────────────────

class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_number: str = Field(unique=True, index=True, max_length=50)
    customer_id: int = Field(foreign_key="customers.id", index=True)
    status: OrderStatus = Field(default=OrderStatus.PENDING)
    subtotal: float = Field(default=0.0)
    tax: float = Field(default=0.0)
    shipping_fee: float = Field(default=0.0)
    discount: float = Field(default=0.0)
    total: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=10)
    shipping_address: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    customer: Optional[Customer] = Relationship(back_populates="orders")
    items: List["OrderItem"] = Relationship(back_populates="order")
    shipments: List["Shipment"] = Relationship(back_populates="order")
    payments: List["Payment"] = Relationship(back_populates="order")


# ── Order Item ─────────────────────────────────────────────────────────────────

class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    product_id: int = Field(foreign_key="products.id")
    quantity: int = Field(gt=0)
    unit_price: float
    total_price: float

    order: Optional[Order] = Relationship(back_populates="items")
    product: Optional[Product] = Relationship(back_populates="order_items")


# ── Shipment ───────────────────────────────────────────────────────────────────

class Shipment(SQLModel, table=True):
    __tablename__ = "shipments"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    carrier: Optional[str] = Field(default=None, max_length=100)
    status: ShipmentStatus = Field(default=ShipmentStatus.PENDING)
    shipped_at: Optional[datetime] = Field(default=None)
    estimated_delivery: Optional[datetime] = Field(default=None)
    actual_delivery: Optional[datetime] = Field(default=None)
    delay_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order: Optional[Order] = Relationship(back_populates="shipments")


# ── Payment ────────────────────────────────────────────────────────────────────

class Payment(SQLModel, table=True):
    __tablename__ = "payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    method: PaymentMethod = Field(default=PaymentMethod.COD)
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    amount: float
    transaction_id: Optional[str] = Field(default=None, max_length=200)
    paid_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order: Optional[Order] = Relationship(back_populates="payments")


# ── Support Ticket ─────────────────────────────────────────────────────────────

class SupportTicket(SQLModel, table=True):
    __tablename__ = "support_tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customers.id", index=True)
    order_id: Optional[int] = Field(default=None, foreign_key="orders.id")
    subject: str = Field(max_length=500)
    description: str
    priority: TicketPriority = Field(default=TicketPriority.MEDIUM)
    status: TicketStatus = Field(default=TicketStatus.OPEN)
    assigned_to: Optional[str] = Field(default=None, max_length=255)
    resolution_notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = Field(default=None)

    customer: Optional[Customer] = Relationship(back_populates="support_tickets")


# ── Marketing Campaign ─────────────────────────────────────────────────────────

class MarketingCampaign(SQLModel, table=True):
    __tablename__ = "marketing_campaigns"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=255)
    campaign_type: str = Field(max_length=100)  # EMAIL, SMS, SOCIAL, etc.
    description: Optional[str] = Field(default=None)
    target_audience: Optional[str] = Field(default=None)
    budget: Optional[float] = Field(default=None)
    status: str = Field(default="DRAFT", max_length=50)  # DRAFT, ACTIVE, PAUSED, COMPLETED
    discount_code: Optional[str] = Field(default=None, max_length=50)
    discount_percent: Optional[float] = Field(default=None)
    start_date: Optional[datetime] = Field(default=None)
    end_date: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Agent Execution ────────────────────────────────────────────────────────────

class AgentExecution(SQLModel, table=True):
    __tablename__ = "agent_executions"

    id: Optional[int] = Field(default=None, primary_key=True)
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, max_length=36)
    session_id: str = Field(max_length=50)
    agent_name: str = Field(max_length=100)
    trigger_event: str = Field(max_length=100)
    input_payload: Optional[str] = Field(default=None)  # JSON string
    status: str = Field(default="RUNNING", max_length=20)  # RUNNING, COMPLETED, FAILED
    output_summary: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    execution_time_ms: Optional[int] = Field(default=None)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = Field(default=None)

    actions: List["AgentAction"] = Relationship(back_populates="execution")


# ── Agent Action ───────────────────────────────────────────────────────────────

class AgentAction(SQLModel, table=True):
    __tablename__ = "agent_actions"

    id: Optional[int] = Field(default=None, primary_key=True)
    execution_id: int = Field(foreign_key="agent_executions.id", index=True)
    action_type: str = Field(max_length=100)
    parameters: Optional[str] = Field(default=None)  # JSON string
    risk_level: RiskLevel = Field(default=RiskLevel.LOW)
    status: str = Field(default="PENDING", max_length=20)  # PENDING, EXECUTED, BLOCKED, APPROVED, REJECTED
    result: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    execution: Optional[AgentExecution] = Relationship(back_populates="actions")
    approval: Optional["Approval"] = Relationship(back_populates="action")


# ── Approval ───────────────────────────────────────────────────────────────────

class Approval(SQLModel, table=True):
    __tablename__ = "approvals"

    id: Optional[int] = Field(default=None, primary_key=True)
    action_id: int = Field(foreign_key="agent_actions.id", index=True)
    requested_by_agent: str = Field(max_length=100)
    reason: Optional[str] = Field(default=None)
    risk_details: Optional[str] = Field(default=None)
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    decided_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    decision_notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    decided_at: Optional[datetime] = Field(default=None)

    action: Optional[AgentAction] = Relationship(back_populates="approval")


# ── Audit Log ──────────────────────────────────────────────────────────────────

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    trace_id: Optional[str] = Field(default=None, max_length=36)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    actor: str = Field(max_length=255)  # user email or agent name
    action: str = Field(max_length=255)
    entity_type: Optional[str] = Field(default=None, max_length=100)
    entity_id: Optional[int] = Field(default=None)
    risk_level: str = Field(default="LOW", max_length=20)
    result: str = Field(default="success", max_length=50)
    log_metadata: Optional[str] = Field(default=None)  # JSON string


# ── Agent Memory ───────────────────────────────────────────────────────────────

class AgentMemory(SQLModel, table=True):
    __tablename__ = "agent_memories"

    id: Optional[int] = Field(default=None, primary_key=True)
    agent_name: str = Field(max_length=100, index=True)
    session_id: str = Field(max_length=50, index=True)
    key: str = Field(max_length=255)
    value: str  # JSON string
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = Field(default=None)


# ── Knowledge Document (RAG) ───────────────────────────────────────────────────

class KnowledgeDocument(SQLModel, table=True):
    __tablename__ = "knowledge_documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=500)
    content: str
    category: str = Field(max_length=100, index=True)  # POLICY, FAQ, PROCEDURE, etc.
    source: Optional[str] = Field(default=None, max_length=255)
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(768)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
