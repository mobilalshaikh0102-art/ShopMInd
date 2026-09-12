"""Analytics & Reporting API endpoints."""
import logging
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from app.core.dependencies import get_db, get_current_user
from app.models import Order, OrderItem, Product, Inventory, User, OrderStatus

logger = logging.getLogger("shopmind.api.analytics")
router = APIRouter(prefix="/analytics", tags=["analytics"])


def _now():
    """Naive UTC datetime — matches what the DB stores."""
    return datetime.utcnow()


# ── 1. Sales Trend (last 30 days) ─────────────────────────────────────────────

@router.get("/sales-trend")
def sales_trend(days: int = 30, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Daily revenue and order count for the last N days."""
    cutoff = _now() - timedelta(days=days)
    orders = db.exec(
        select(Order).where(
            Order.created_at >= cutoff,
            Order.status != OrderStatus.CANCELLED,
        )
    ).all()

    # Bucket by date
    buckets: dict[str, dict] = {}
    for i in range(days):
        day = (_now() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        buckets[day] = {"date": day, "revenue": 0.0, "orders": 0}

    for o in orders:
        day = o.created_at.strftime("%Y-%m-%d")
        if day in buckets:
            buckets[day]["revenue"] += o.total
            buckets[day]["orders"] += 1

    return list(buckets.values())


# ── 2. Revenue by Category ────────────────────────────────────────────────────

@router.get("/revenue-by-category")
def revenue_by_category(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Total revenue broken down by product category."""
    rows = db.exec(
        select(Product.category, func.sum(OrderItem.unit_price * OrderItem.quantity).label("revenue"), func.sum(OrderItem.quantity).label("units"))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status != OrderStatus.CANCELLED)
        .group_by(Product.category)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
    ).all()

    return [{"category": r[0], "revenue": round(r[1] or 0, 2), "units": int(r[2] or 0)} for r in rows]


# ── 3. Order Status Breakdown ─────────────────────────────────────────────────

@router.get("/order-status-breakdown")
def order_status_breakdown(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Count of orders grouped by status."""
    rows = db.exec(
        select(Order.status, func.count(Order.id).label("count"))
        .group_by(Order.status)
    ).all()
    return [{"status": r[0], "count": int(r[1])} for r in rows]


# ── 4. Top Products by Revenue ────────────────────────────────────────────────

@router.get("/top-products")
def top_products(limit: int = 10, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Top N products by revenue."""
    rows = db.exec(
        select(
            Product.id,
            Product.name,
            Product.category,
            Product.sku,
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("revenue"),
            func.sum(OrderItem.quantity).label("units_sold"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status != OrderStatus.CANCELLED)
        .group_by(Product.id, Product.name, Product.category, Product.sku)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(limit)
    ).all()

    return [
        {
            "id": r[0], "name": r[1], "category": r[2], "sku": r[3],
            "revenue": round(r[4] or 0, 2), "units_sold": int(r[5] or 0),
        }
        for r in rows
    ]


# ── 5. Revenue Heatmap (hour × weekday) ──────────────────────────────────────

@router.get("/revenue-heatmap")
def revenue_heatmap(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Revenue summed by hour-of-day and day-of-week for heatmap visualisation."""
    orders = db.exec(
        select(Order).where(Order.status != OrderStatus.CANCELLED)
    ).all()

    DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    grid: dict[tuple, float] = {}
    for hour in range(24):
        for dow in range(7):
            grid[(dow, hour)] = 0.0

    for o in orders:
        dow = o.created_at.weekday()   # 0=Mon
        hour = o.created_at.hour
        grid[(dow, hour)] += o.total

    result = []
    for (dow, hour), revenue in grid.items():
        result.append({
            "day": DAYS[dow],
            "day_index": dow,
            "hour": hour,
            "revenue": round(revenue, 2),
        })
    return result


# ── 6. Demand Forecast Summary (all products) ─────────────────────────────────

@router.get("/demand-forecast-summary")
def demand_forecast_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """30-day demand forecast for every active product with inventory."""
    from app.ml.forecaster import demand_forecaster

    products = db.exec(
        select(Product, Inventory)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(Product.is_active == True)
        .order_by(Inventory.sales_velocity_30d.desc())
        .limit(15)
    ).all()

    results = []
    for product, inv in products:
        try:
            fc = demand_forecaster.forecast(db, product.id)
            results.append({
                "product_id": product.id,
                "name": product.name,
                "sku": product.sku,
                "category": product.category,
                "current_stock": inv.current_stock,
                "reorder_threshold": inv.reorder_threshold,
                "sales_velocity_30d": inv.sales_velocity_30d,
                "forecast_days": fc.get("forecast_days", 30),
                "forecasted_demand": fc.get("forecasted_demand", 0),
                "days_of_stock": fc.get("days_of_stock_remaining", 0),
                "recommended_restock": fc.get("recommended_restock_quantity", 0),
                "risk_level": fc.get("risk_level", "LOW"),
            })
        except Exception:
            pass

    return results


# ── 7. KPI Summary ────────────────────────────────────────────────────────────

@router.get("/kpi-summary")
def kpi_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """High-level KPIs: total revenue, AOV, conversion, growth."""
    from app.models import Customer

    all_orders = db.exec(select(Order).where(Order.status != OrderStatus.CANCELLED)).all()
    total_revenue = sum(o.total for o in all_orders)
    total_orders = len(all_orders)
    aov = total_revenue / total_orders if total_orders else 0

    # This month vs last month — use naive UTC to match DB
    now = _now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    this_month = [o for o in all_orders if o.created_at >= this_month_start]
    last_month = [o for o in all_orders if last_month_start <= o.created_at < this_month_start]

    this_rev = sum(o.total for o in this_month)
    last_rev = sum(o.total for o in last_month)
    revenue_growth = ((this_rev - last_rev) / last_rev * 100) if last_rev else 0

    total_customers = db.exec(select(func.count(Customer.id))).one() or 0

    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "avg_order_value": round(aov, 2),
        "total_customers": total_customers,
        "this_month_revenue": round(this_rev, 2),
        "last_month_revenue": round(last_rev, 2),
        "revenue_growth_pct": round(revenue_growth, 1),
        "this_month_orders": len(this_month),
        "last_month_orders": len(last_month),
    }
