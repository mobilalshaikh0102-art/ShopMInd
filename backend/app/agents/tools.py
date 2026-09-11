"""Business tool functions called by LangGraph agents."""
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("shopmind.tools")


def _get_db_session():
    from app.db.session import engine
    from sqlmodel import Session
    return Session(engine)


# ── Inventory Tools ────────────────────────────────────────────────────────────

def get_inventory_status(product_id: int) -> Dict[str, Any]:
    """Get detailed inventory status for a specific product."""
    try:
        with _get_db_session() as db:
            from app.repositories import inventory_repo, product_repo
            inv = inventory_repo.get_by_product(db, product_id)
            product = product_repo.get(db, product_id)
            if not inv or not product:
                return {"error": f"Product {product_id} not found"}
            return {
                "product_id": product_id,
                "product_name": product.name,
                "sku": product.sku,
                "category": product.category,
                "current_stock": inv.current_stock,
                "reorder_threshold": inv.reorder_threshold,
                "reorder_quantity": inv.reorder_quantity,
                "sales_velocity_30d": inv.sales_velocity_30d,
                "is_low_stock": inv.current_stock <= inv.reorder_threshold,
                "days_of_stock_remaining": round(inv.current_stock / inv.sales_velocity_30d, 1) if inv.sales_velocity_30d > 0 else 999,
            }
    except Exception as e:
        logger.error(f"get_inventory_status error: {e}")
        return {"error": str(e)}


def get_low_stock_products() -> List[Dict[str, Any]]:
    """Get all products with stock below reorder threshold."""
    try:
        with _get_db_session() as db:
            from app.repositories import inventory_repo, product_repo
            low_inv = inventory_repo.get_low_stock(db)
            results = []
            for inv in low_inv:
                product = product_repo.get(db, inv.product_id)
                if product:
                    results.append({
                        "product_id": inv.product_id,
                        "product_name": product.name,
                        "sku": product.sku,
                        "category": product.category,
                        "current_stock": inv.current_stock,
                        "reorder_threshold": inv.reorder_threshold,
                        "reorder_quantity": inv.reorder_quantity,
                        "sales_velocity_30d": inv.sales_velocity_30d,
                        "deficit": inv.reorder_threshold - inv.current_stock,
                    })
            return results
    except Exception as e:
        logger.error(f"get_low_stock_products error: {e}")
        return []


def get_all_inventory_summary() -> List[Dict[str, Any]]:
    """Get summary of all inventory items."""
    try:
        with _get_db_session() as db:
            from app.repositories import inventory_repo, product_repo
            all_inv = inventory_repo.get_all(db)
            results = []
            for inv in all_inv[:20]:  # Limit for context window
                product = product_repo.get(db, inv.product_id)
                if product:
                    results.append({
                        "product_name": product.name,
                        "sku": product.sku,
                        "current_stock": inv.current_stock,
                        "reorder_threshold": inv.reorder_threshold,
                        "status": "LOW" if inv.current_stock <= inv.reorder_threshold else "OK",
                    })
            return results
    except Exception as e:
        logger.error(f"get_all_inventory_summary error: {e}")
        return []


# ── Order Tools ────────────────────────────────────────────────────────────────

def get_orders_by_status(status: str) -> List[Dict[str, Any]]:
    """Get orders filtered by status."""
    try:
        with _get_db_session() as db:
            from app.repositories import order_repo, customer_repo
            orders = order_repo.get_by_status(db, status)[:15]
            results = []
            for o in orders:
                customer = customer_repo.get(db, o.customer_id)
                results.append({
                    "order_id": o.id,
                    "order_number": o.order_number,
                    "customer_name": customer.name if customer else "Unknown",
                    "status": o.status,
                    "total": o.total,
                    "currency": o.currency,
                    "created_at": o.created_at.isoformat(),
                })
            return results
    except Exception as e:
        logger.error(f"get_orders_by_status error: {e}")
        return []


def get_order_details(order_id: int) -> Dict[str, Any]:
    """Get full details of a specific order."""
    try:
        with _get_db_session() as db:
            from app.repositories import order_repo, customer_repo, product_repo
            order = order_repo.get(db, order_id)
            if not order:
                return {"error": f"Order {order_id} not found"}
            customer = customer_repo.get(db, order.customer_id)
            items = []
            for item in (order.items or []):
                product = product_repo.get(db, item.product_id)
                items.append({
                    "product_name": product.name if product else f"Product #{item.product_id}",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price,
                })
            return {
                "order_id": order.id,
                "order_number": order.order_number,
                "customer_name": customer.name if customer else "Unknown",
                "customer_email": customer.email if customer else "",
                "status": order.status,
                "items": items,
                "subtotal": order.subtotal,
                "tax": order.tax,
                "total": order.total,
                "currency": order.currency,
                "shipping_address": order.shipping_address,
                "created_at": order.created_at.isoformat(),
            }
    except Exception as e:
        logger.error(f"get_order_details error: {e}")
        return {"error": str(e)}


def get_recent_orders(limit: int = 10) -> List[Dict[str, Any]]:
    """Get the most recent orders."""
    try:
        with _get_db_session() as db:
            from app.repositories import order_repo, customer_repo
            orders = order_repo.get_all(db, skip=0, limit=limit)
            return [
                {
                    "order_number": o.order_number,
                    "status": o.status,
                    "total": o.total,
                    "created_at": o.created_at.isoformat(),
                }
                for o in orders
            ]
    except Exception as e:
        return []


# ── Shipment Tools ─────────────────────────────────────────────────────────────

def get_delayed_shipments() -> List[Dict[str, Any]]:
    """Get all delayed shipments with order context."""
    try:
        with _get_db_session() as db:
            from app.repositories import shipment_repo, order_repo, customer_repo
            delayed = shipment_repo.get_delayed(db)
            results = []
            for s in delayed:
                order = order_repo.get(db, s.order_id)
                customer = customer_repo.get(db, order.customer_id) if order else None
                results.append({
                    "shipment_id": s.id,
                    "order_number": order.order_number if order else "Unknown",
                    "customer_name": customer.name if customer else "Unknown",
                    "tracking_number": s.tracking_number,
                    "carrier": s.carrier,
                    "status": s.status,
                    "delay_reason": s.delay_reason,
                    "estimated_delivery": s.estimated_delivery.isoformat() if s.estimated_delivery else None,
                })
            return results
    except Exception as e:
        logger.error(f"get_delayed_shipments error: {e}")
        return []


def get_all_shipments_summary() -> Dict[str, Any]:
    """Get shipment statistics."""
    try:
        with _get_db_session() as db:
            from app.repositories import shipment_repo
            all_shipments = shipment_repo.get_all(db)
            status_counts = {}
            for s in all_shipments:
                status_counts[s.status] = status_counts.get(s.status, 0) + 1
            return {"total": len(all_shipments), "by_status": status_counts}
    except Exception as e:
        return {"error": str(e)}


# ── Pricing Tools ──────────────────────────────────────────────────────────────

def get_pricing_recommendations() -> List[Dict[str, Any]]:
    """Generate pricing recommendations based on inventory and sales velocity."""
    try:
        with _get_db_session() as db:
            from app.repositories import inventory_repo, product_repo
            all_inv = inventory_repo.get_all(db)
            recommendations = []
            for inv in all_inv[:20]:
                product = product_repo.get(db, inv.product_id)
                if not product:
                    continue
                margin = ((product.price - product.cost_price) / product.price) * 100
                # High stock + low velocity → suggest discount
                if inv.current_stock > inv.reorder_threshold * 3 and inv.sales_velocity_30d < 5:
                    action = "DISCOUNT"
                    suggested_change = -10.0
                    reason = "Overstock with low sales velocity"
                # Low stock + high velocity → suggest price increase
                elif inv.current_stock <= inv.reorder_threshold and inv.sales_velocity_30d > 20:
                    action = "INCREASE"
                    suggested_change = 8.0
                    reason = "High demand with low stock"
                else:
                    action = "MAINTAIN"
                    suggested_change = 0.0
                    reason = "Stock and velocity balanced"
                recommendations.append({
                    "product_id": product.id,
                    "product_name": product.name,
                    "sku": product.sku,
                    "current_price": product.price,
                    "cost_price": product.cost_price,
                    "margin_percent": round(margin, 2),
                    "current_stock": inv.current_stock,
                    "sales_velocity_30d": inv.sales_velocity_30d,
                    "recommended_action": action,
                    "suggested_price_change_percent": suggested_change,
                    "suggested_new_price": round(product.price * (1 + suggested_change / 100), 2),
                    "reason": reason,
                    "risk": "HIGH" if abs(suggested_change) > 10 else "LOW",
                })
            return recommendations
    except Exception as e:
        logger.error(f"get_pricing_recommendations error: {e}")
        return []


# ── Analytics Tools ────────────────────────────────────────────────────────────

def get_business_summary() -> Dict[str, Any]:
    """Get high-level business metrics summary."""
    try:
        with _get_db_session() as db:
            from app.repositories import (
                order_repo, inventory_repo, shipment_repo, ticket_repo, approval_repo
            )
            from sqlmodel import select, func
            from app.models import Order

            total_orders = db.exec(select(func.count(Order.id))).one() or 0
            pending_orders = order_repo.count_by_status(db, "PENDING")
            low_stock = len(inventory_repo.get_low_stock(db))
            delayed_ships = len(shipment_repo.get_delayed(db))
            open_tickets = ticket_repo.count_open(db)
            pending_approvals = len(approval_repo.get_pending(db))

            # Revenue calculation
            all_orders = order_repo.get_all(db, skip=0, limit=500)
            total_revenue = sum(o.total for o in all_orders if o.status != "CANCELLED")

            return {
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "low_stock_products": low_stock,
                "delayed_shipments": delayed_ships,
                "open_support_tickets": open_tickets,
                "pending_approvals": pending_approvals,
                "total_revenue": round(total_revenue, 2),
            }
    except Exception as e:
        logger.error(f"get_business_summary error: {e}")
        return {}


def get_sales_by_category() -> List[Dict[str, Any]]:
    """Get sales breakdown by product category."""
    try:
        with _get_db_session() as db:
            from app.repositories import order_repo, product_repo
            from app.models import OrderItem
            from sqlmodel import select
            items = db.exec(select(OrderItem)).all()
            category_sales: Dict[str, float] = {}
            for item in items:
                product = product_repo.get(db, item.product_id)
                if product:
                    cat = product.category
                    category_sales[cat] = category_sales.get(cat, 0) + item.total_price
            return [{"category": k, "total_sales": round(v, 2)} for k, v in sorted(category_sales.items(), key=lambda x: -x[1])]
    except Exception as e:
        return []


def get_customer_tickets(customer_id: int) -> List[Dict[str, Any]]:
    """Get support tickets for a specific customer."""
    try:
        with _get_db_session() as db:
            from app.repositories import ticket_repo
            tickets = ticket_repo.get_by_customer(db, customer_id)
            return [
                {
                    "ticket_id": t.id,
                    "subject": t.subject,
                    "priority": t.priority,
                    "status": t.status,
                    "created_at": t.created_at.isoformat(),
                }
                for t in tickets
            ]
    except Exception as e:
        return []
