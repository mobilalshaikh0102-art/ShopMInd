"""Pydantic request/response schemas for all ShopMind resources."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.models import (
    ApprovalStatus, OrderStatus, PaymentMethod, PaymentStatus,
    ShipmentStatus, TicketPriority, TicketStatus, RiskLevel,
)


# ── Auth ───────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role_name: str = "CUSTOMER"


# ── Role ───────────────────────────────────────────────────────────────────────

class RoleRead(BaseModel):
    id: int
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


# ── User ───────────────────────────────────────────────────────────────────────

class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    role: RoleRead
    created_at: datetime

    class Config:
        from_attributes = True


# ── Customer ───────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    pincode: Optional[str] = None


class CustomerRead(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Product ────────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    sku: str
    name: str
    category: str
    description: Optional[str] = None
    price: float
    cost_price: float
    currency: str = "INR"
    brand: Optional[str] = None
    weight_kg: Optional[float] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    brand: Optional[str] = None
    is_active: Optional[bool] = None


class ProductRead(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    description: Optional[str]
    price: float
    cost_price: float
    currency: str
    brand: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Inventory ──────────────────────────────────────────────────────────────────

class InventoryUpdate(BaseModel):
    current_stock: Optional[int] = None
    reorder_threshold: Optional[int] = None
    reorder_quantity: Optional[int] = None
    sales_velocity_30d: Optional[float] = None
    warehouse_location: Optional[str] = None


class InventoryRead(BaseModel):
    id: int
    product_id: int
    current_stock: int
    reserved_stock: int
    reorder_threshold: int
    reorder_quantity: int
    sales_velocity_30d: float
    warehouse_location: Optional[str]
    last_restocked_at: Optional[datetime]
    updated_at: datetime

    class Config:
        from_attributes = True


class RestockRequest(BaseModel):
    product_id: int
    quantity: int
    notes: Optional[str] = None


# ── Order ──────────────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    customer_id: int
    items: List[OrderItemCreate]
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    currency: str = "INR"


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = None


class OrderItemRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True


class OrderRead(BaseModel):
    id: int
    order_number: str
    customer_id: int
    status: OrderStatus
    subtotal: float
    tax: float
    shipping_fee: float
    discount: float
    total: float
    currency: str
    shipping_address: Optional[str]
    notes: Optional[str]
    items: List[OrderItemRead] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Shipment ───────────────────────────────────────────────────────────────────

class ShipmentCreate(BaseModel):
    order_id: int
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[datetime] = None


class ShipmentStatusUpdate(BaseModel):
    status: ShipmentStatus
    delay_reason: Optional[str] = None
    actual_delivery: Optional[datetime] = None


class ShipmentRead(BaseModel):
    id: int
    order_id: int
    tracking_number: Optional[str]
    carrier: Optional[str]
    status: ShipmentStatus
    shipped_at: Optional[datetime]
    estimated_delivery: Optional[datetime]
    actual_delivery: Optional[datetime]
    delay_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Support Ticket ─────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    customer_id: int
    order_id: Optional[int] = None
    subject: str
    description: str
    priority: TicketPriority = TicketPriority.MEDIUM


class TicketStatusUpdate(BaseModel):
    status: TicketStatus
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None


class TicketRead(BaseModel):
    id: int
    customer_id: int
    order_id: Optional[int]
    subject: str
    description: str
    priority: TicketPriority
    status: TicketStatus
    assigned_to: Optional[str]
    resolution_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Approval ───────────────────────────────────────────────────────────────────

class ApprovalDecision(BaseModel):
    status: ApprovalStatus
    decision_notes: Optional[str] = None


class ApprovalRead(BaseModel):
    id: int
    action_id: int
    requested_by_agent: str
    reason: Optional[str]
    risk_details: Optional[str]
    status: ApprovalStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ── Agent Chat ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    agent: str
    trace_id: str
    requires_approval: bool = False
