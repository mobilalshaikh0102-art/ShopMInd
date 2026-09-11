"""E-commerce business logic services."""
import json
import logging
import random
import string
from datetime import datetime, timezone
from typing import List, Optional

from sqlmodel import Session

from app.models import (
    Product, Inventory, Order, OrderItem, Shipment,
    SupportTicket, Approval, AgentAction, AuditLog,
    OrderStatus, ShipmentStatus, TicketStatus, ApprovalStatus, RiskLevel,
)
from app.repositories import (
    product_repo, inventory_repo, order_repo, shipment_repo,
    ticket_repo, approval_repo, audit_repo,
)
from app.schemas import (
    ProductCreate, ProductUpdate, InventoryUpdate, RestockRequest,
    OrderCreate, OrderStatusUpdate, ShipmentCreate, ShipmentStatusUpdate,
    TicketCreate, TicketStatusUpdate, ApprovalDecision,
)

logger = logging.getLogger("shopmind.services")


def _generate_order_number() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"ORD-{suffix}"


# ── Product Service ────────────────────────────────────────────────────────────

class ProductService:
    def list_products(self, db: Session, skip: int = 0, limit: int = 100) -> List[Product]:
        return product_repo.get_all(db, skip, limit)

    def get(self, db: Session, product_id: int) -> Optional[Product]:
        return product_repo.get(db, product_id)

    def create(self, db: Session, data: ProductCreate) -> Product:
        if product_repo.get_by_sku(db, data.sku):
            raise ValueError(f"SKU '{data.sku}' already exists")
        product = Product(**data.model_dump())
        db.add(product)
        db.flush()
        # Auto-create inventory record
        inv = Inventory(product_id=product.id)
        db.add(inv)
        db.commit()
        db.refresh(product)
        return product

    def update(self, db: Session, product_id: int, data: ProductUpdate) -> Product:
        product = product_repo.get(db, product_id)
        if not product:
            raise ValueError("Product not found")
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(product, k, v)
        product.updated_at = datetime.now(timezone.utc)
        return product_repo.update(db, product)


# ── Inventory Service ──────────────────────────────────────────────────────────

class InventoryService:
    def get_all(self, db: Session) -> List[Inventory]:
        return inventory_repo.get_all(db)

    def get_by_product(self, db: Session, product_id: int) -> Optional[Inventory]:
        return inventory_repo.get_by_product(db, product_id)

    def get_low_stock(self, db: Session) -> List[Inventory]:
        return inventory_repo.get_low_stock(db)

    def update(self, db: Session, product_id: int, data: InventoryUpdate) -> Inventory:
        inv = inventory_repo.get_by_product(db, product_id)
        if not inv:
            raise ValueError("Inventory record not found")
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(inv, k, v)
        return inventory_repo.update(db, inv)

    def request_restock(self, db: Session, req: RestockRequest, actor: str = "system") -> dict:
        inv = inventory_repo.get_by_product(db, req.product_id)
        if not inv:
            raise ValueError("Inventory record not found")
        product = product_repo.get(db, req.product_id)
        restock_cost = req.quantity * (product.cost_price if product else 0)

        # Risk assessment
        if restock_cost > 5000:
            risk = RiskLevel.HIGH
            # Create pending approval
            action = AgentAction(
                execution_id=1,
                action_type="RESTOCK",
                parameters=json.dumps({"product_id": req.product_id, "quantity": req.quantity}),
                risk_level=risk,
                status="PENDING",
            )
            db.add(action)
            db.flush()
            approval = Approval(
                action_id=action.id,
                requested_by_agent="InventoryAgent",
                reason=f"Restock {req.quantity} units of {product.name if product else 'product'} costs ₹{restock_cost:,.0f}",
                risk_details=f"Cost: ₹{restock_cost:,.0f} | Quantity: {req.quantity}",
            )
            db.add(approval)
            db.commit()
            audit_repo.log_action(db, actor, "RESTOCK_REQUESTED", "Inventory", req.product_id, "HIGH", "pending")
            return {"status": "pending_approval", "restock_cost": restock_cost, "message": "High-cost restock requires approval"}
        else:
            # Execute immediately
            inv.current_stock += req.quantity
            inv.last_restocked_at = datetime.now(timezone.utc)
            inventory_repo.update(db, inv)
            audit_repo.log_action(db, actor, "RESTOCK_EXECUTED", "Inventory", req.product_id, "LOW", "success")
            return {"status": "executed", "new_stock": inv.current_stock}


# ── Order Service ──────────────────────────────────────────────────────────────

class OrderService:
    def list_orders(self, db: Session, status: Optional[str] = None, skip: int = 0, limit: int = 100, customer_id: Optional[int] = None) -> List[Order]:
        if customer_id:
            orders = order_repo.get_by_customer(db, customer_id)
            if status:
                orders = [o for o in orders if o.status == status]
            return orders[skip:skip + limit]
        if status:
            return order_repo.get_by_status(db, status)[skip:skip + limit]
        return order_repo.get_all(db, skip, limit)

    def get(self, db: Session, order_id: int) -> Optional[Order]:
        return order_repo.get(db, order_id)

    def create_order(self, db: Session, data: OrderCreate) -> Order:
        order_number = _generate_order_number()
        while order_repo.get_by_order_number(db, order_number):
            order_number = _generate_order_number()

        order = Order(
            order_number=order_number,
            customer_id=data.customer_id,
            shipping_address=data.shipping_address,
            notes=data.notes,
            currency=data.currency,
        )
        db.add(order)
        db.flush()

        subtotal = 0.0
        for item_data in data.items:
            product = product_repo.get(db, item_data.product_id)
            if not product:
                raise ValueError(f"Product {item_data.product_id} not found")
            unit_price = product.price
            item_total = unit_price * item_data.quantity
            subtotal += item_total
            item = OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=unit_price,
                total_price=item_total,
            )
            db.add(item)

        tax = round(subtotal * 0.18, 2)  # 18% GST
        order.subtotal = round(subtotal, 2)
        order.tax = tax
        order.shipping_fee = 0.0 if subtotal > 500 else 50.0
        order.total = round(subtotal + tax + order.shipping_fee, 2)
        db.add(order)
        db.commit()
        db.refresh(order)
        return order

    def update_status(self, db: Session, order_id: int, data: OrderStatusUpdate) -> Order:
        order = order_repo.get(db, order_id)
        if not order:
            raise ValueError("Order not found")
        order.status = data.status
        if data.notes:
            order.notes = data.notes
        return order_repo.update(db, order)


# ── Shipment Service ───────────────────────────────────────────────────────────

class ShipmentService:
    def list_shipments(self, db: Session) -> List[Shipment]:
        return shipment_repo.get_all(db)

    def get_delayed(self, db: Session) -> List[Shipment]:
        return shipment_repo.get_delayed(db)

    def create(self, db: Session, data: ShipmentCreate) -> Shipment:
        order = order_repo.get(db, data.order_id)
        if not order:
            raise ValueError("Order not found")
        shipment = Shipment(
            order_id=data.order_id,
            tracking_number=data.tracking_number,
            carrier=data.carrier,
            estimated_delivery=data.estimated_delivery,
            shipped_at=datetime.now(timezone.utc),
            status=ShipmentStatus.IN_TRANSIT,
        )
        db.add(shipment)
        # Update order status to SHIPPED
        order.status = OrderStatus.SHIPPED
        db.add(order)
        db.commit()
        db.refresh(shipment)
        return shipment

    def update_status(self, db: Session, shipment_id: int, data: ShipmentStatusUpdate) -> Shipment:
        shipment = shipment_repo.get(db, shipment_id)
        if not shipment:
            raise ValueError("Shipment not found")
        shipment.status = data.status
        if data.delay_reason:
            shipment.delay_reason = data.delay_reason
        if data.actual_delivery:
            shipment.actual_delivery = data.actual_delivery
        if data.status == ShipmentStatus.DELIVERED:
            order = order_repo.get(db, shipment.order_id)
            if order:
                order.status = OrderStatus.DELIVERED
                db.add(order)
        return shipment_repo.update(db, shipment)


# ── Ticket Service ─────────────────────────────────────────────────────────────

class TicketService:
    def list_tickets(self, db: Session, status: Optional[str] = None, customer_id: Optional[int] = None) -> List[SupportTicket]:
        return ticket_repo.get_all(db, status, customer_id)

    def create(self, db: Session, data: TicketCreate) -> SupportTicket:
        ticket = SupportTicket(**data.model_dump())
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return ticket

    def update_status(self, db: Session, ticket_id: int, data: TicketStatusUpdate) -> SupportTicket:
        ticket = ticket_repo.get(db, ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        ticket.status = data.status
        if data.assigned_to:
            ticket.assigned_to = data.assigned_to
        if data.resolution_notes:
            ticket.resolution_notes = data.resolution_notes
        if data.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
            ticket.resolved_at = datetime.now(timezone.utc)
        return ticket_repo.update(db, ticket)


# ── Approvals Service ──────────────────────────────────────────────────────────

class ApprovalsService:
    def list_pending(self, db: Session) -> List[Approval]:
        return approval_repo.get_pending(db)

    def decide(self, db: Session, approval_id: int, data: ApprovalDecision, user_id: int) -> Approval:
        approval = approval_repo.get(db, approval_id)
        if not approval:
            raise ValueError("Approval not found")
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError("Approval already decided")
        approval.status = data.status
        approval.decided_by_user_id = user_id
        approval.decision_notes = data.decision_notes
        approval.decided_at = datetime.now(timezone.utc)

        # Update action status
        action = db.get(AgentAction, approval.action_id)
        if action:
            action.status = "APPROVED" if data.status == ApprovalStatus.APPROVED else "REJECTED"
            db.add(action)

        audit_repo.log_action(
            db, f"User_{user_id}", f"APPROVAL_{data.status}",
            "Approval", approval_id, "HIGH", "success"
        )
        return approval_repo.update(db, approval)


# ── Singletons ──────────────────────────────────────────────────────────────────

product_service = ProductService()
inventory_service = InventoryService()
order_service = OrderService()
shipment_service = ShipmentService()
ticket_service = TicketService()
approvals_service = ApprovalsService()
