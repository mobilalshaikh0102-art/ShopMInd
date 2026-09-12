"""Third-Party Integrations API endpoints."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_ops
from app.models import User
from app.services.integrations import (
    shopify_service, payment_service, whatsapp_service, email_service
)

logger = logging.getLogger("shopmind.api.integrations")
router = APIRouter(prefix="/integrations", tags=["integrations"])


# ── Status / Health ──────────────────────────────────────────────────────────

@router.get("/status")
def get_all_status(_: User = Depends(get_current_user)):
    """Return connection status for all integrations."""
    return {
        "shopify": shopify_service.get_status(),
        "razorpay": payment_service.get_status()["razorpay"],
        "stripe": payment_service.get_status()["stripe"],
        "whatsapp": whatsapp_service.get_status(),
        "email": email_service.get_status(),
    }


# ── Shopify ───────────────────────────────────────────────────────────────────

@router.get("/shopify/products")
def shopify_sync_products(_: User = Depends(get_current_user)):
    return shopify_service.sync_products()


@router.get("/shopify/orders")
def shopify_sync_orders(_: User = Depends(get_current_user)):
    return shopify_service.sync_orders()


# ── Payments ──────────────────────────────────────────────────────────────────

@router.get("/payments/razorpay")
def razorpay_stats(_: User = Depends(get_current_user)):
    return payment_service.get_razorpay_stats()


@router.get("/payments/stripe")
def stripe_stats(_: User = Depends(get_current_user)):
    return payment_service.get_stripe_stats()


# ── WhatsApp ──────────────────────────────────────────────────────────────────

class WhatsAppPayload(BaseModel):
    to: str
    message: str


class OrderAlertPayload(BaseModel):
    phone: str
    order_number: str
    status: str


class ShipmentAlertPayload(BaseModel):
    phone: str
    order_number: str
    delay_reason: str


class LowStockAlertPayload(BaseModel):
    phone: str
    product_name: str
    stock: int


@router.post("/whatsapp/send")
def whatsapp_send(payload: WhatsAppPayload, _: User = Depends(require_ops)):
    return whatsapp_service.send_message(payload.to, payload.message)


@router.post("/whatsapp/order-update")
def whatsapp_order_update(payload: OrderAlertPayload, _: User = Depends(require_ops)):
    return whatsapp_service.send_order_update(payload.phone, payload.order_number, payload.status)


@router.post("/whatsapp/shipment-alert")
def whatsapp_shipment_alert(payload: ShipmentAlertPayload, _: User = Depends(require_ops)):
    return whatsapp_service.send_shipment_alert(payload.phone, payload.order_number, payload.delay_reason)


@router.post("/whatsapp/low-stock-alert")
def whatsapp_low_stock(payload: LowStockAlertPayload, _: User = Depends(require_ops)):
    return whatsapp_service.send_low_stock_alert(payload.phone, payload.product_name, payload.stock)


# ── Email ─────────────────────────────────────────────────────────────────────

class EmailPayload(BaseModel):
    to: str
    subject: str
    body: str


class TicketReplyPayload(BaseModel):
    customer_email: str
    ticket_subject: str
    reply_body: str


class OrderConfirmPayload(BaseModel):
    customer_email: str
    order_number: str
    total: float


@router.post("/email/send")
def email_send(payload: EmailPayload, _: User = Depends(require_ops)):
    return email_service.send_email(payload.to, payload.subject, payload.body, payload.body)


@router.post("/email/ticket-reply")
def email_ticket_reply(payload: TicketReplyPayload, _: User = Depends(require_ops)):
    return email_service.send_ticket_reply(
        payload.customer_email, payload.ticket_subject, payload.reply_body
    )


@router.post("/email/order-confirmation")
def email_order_confirm(payload: OrderConfirmPayload, _: User = Depends(require_ops)):
    return email_service.send_order_confirmation(
        payload.customer_email, payload.order_number, payload.total
    )
