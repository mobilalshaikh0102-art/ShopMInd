"""Logistics & Supply Chain API — Shiprocket tracking, vendors, purchase orders."""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, Field, SQLModel

from app.core.dependencies import get_db, get_current_user, require_ops
from app.models import User, Shipment, Inventory, Product
from app.core.config import settings

logger = logging.getLogger("shopmind.api.logistics")
router = APIRouter(prefix="/logistics", tags=["logistics"])

# ── In-memory vendor & PO store (no new migration needed) ─────────────────────
# In production these would be SQLModel tables; for now we use a module-level
# list that survives the request lifecycle (resets on server restart).
_VENDORS: List[dict] = [
    {"id": 1, "name": "ElectroHub Supplies", "contact": "Ramesh Kumar", "email": "ramesh@electrohub.in", "phone": "+91-9876543210", "category": "Electronics", "lead_time_days": 7, "rating": 4.5, "active": True},
    {"id": 2, "name": "HomeStyle Wholesale", "contact": "Priya Mehta", "email": "priya@homestyle.in", "phone": "+91-9123456789", "category": "Home & Kitchen", "lead_time_days": 5, "rating": 4.2, "active": True},
    {"id": 3, "name": "SportsGear Direct", "contact": "Arun Singh", "email": "arun@sportsgear.in", "phone": "+91-9988776655", "category": "Sports", "lead_time_days": 10, "rating": 3.9, "active": True},
    {"id": 4, "name": "FashionForward Corp", "contact": "Neha Sharma", "email": "neha@fashionforward.in", "phone": "+91-9871234560", "category": "Clothing", "lead_time_days": 14, "rating": 4.7, "active": True},
]
_PURCHASE_ORDERS: List[dict] = [
    {"id": 1, "vendor_id": 1, "vendor_name": "ElectroHub Supplies", "product_name": "Smart Air Purifier with HEPA Filter", "sku": "ELEC-001", "quantity": 50, "unit_cost": 4500.0, "total_cost": 225000.0, "status": "RECEIVED", "created_at": "2026-09-01T10:00:00", "expected_date": "2026-09-08T10:00:00", "notes": "Urgent restock due to high demand"},
    {"id": 2, "vendor_id": 2, "vendor_name": "HomeStyle Wholesale", "product_name": "Non-Stick Cookware Set", "sku": "HOME-002", "quantity": 30, "unit_cost": 1200.0, "total_cost": 36000.0, "status": "ORDERED", "created_at": "2026-09-10T09:00:00", "expected_date": "2026-09-15T09:00:00", "notes": ""},
    {"id": 3, "vendor_id": 1, "vendor_name": "ElectroHub Supplies", "product_name": "4K Webcam Ultra HD", "sku": "ELEC-003", "quantity": 25, "unit_cost": 3200.0, "total_cost": 80000.0, "status": "PENDING", "created_at": "2026-09-12T08:00:00", "expected_date": "2026-09-19T08:00:00", "notes": "AI-triggered restock"},
]
_VENDOR_SEQ = 5
_PO_SEQ = 4


# ── Shiprocket Tracking ───────────────────────────────────────────────────────

def _demo_tracking(awb: str) -> dict:
    """Return plausible demo tracking data."""
    import random, hashlib
    seed = int(hashlib.md5(awb.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    statuses = ["DELIVERED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "PROCESSING", "PICKED_UP"]
    carriers = ["Delhivery", "BlueDart", "DTDC", "Xpressbees", "Ekart"]
    status = random.choice(statuses)
    carrier = random.choice(carriers)
    cities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad"]

    now = datetime.utcnow()
    events = []
    if status in ["DELIVERED", "OUT_FOR_DELIVERY", "IN_TRANSIT", "PICKED_UP"]:
        events.append({"timestamp": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M"), "location": random.choice(cities), "description": "Shipment picked up by courier"})
    if status in ["DELIVERED", "OUT_FOR_DELIVERY", "IN_TRANSIT"]:
        events.append({"timestamp": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M"), "location": random.choice(cities), "description": "In transit to next hub"})
        events.append({"timestamp": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M"), "location": random.choice(cities), "description": "Arrived at destination hub"})
    if status == "OUT_FOR_DELIVERY":
        events.append({"timestamp": now.strftime("%Y-%m-%d %H:%M"), "location": random.choice(cities), "description": "Out for delivery"})
    if status == "DELIVERED":
        events.append({"timestamp": (now - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"), "location": random.choice(cities), "description": "Delivered successfully"})

    return {
        "awb": awb,
        "source": "demo",
        "carrier": carrier,
        "status": status,
        "estimated_delivery": (now + timedelta(days=1 if status != "DELIVERED" else 0)).strftime("%Y-%m-%d"),
        "events": list(reversed(events)),
        "note": "Demo tracking. Add SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD to .env for live data.",
    }


def _shiprocket_tracking(awb: str) -> dict:
    email = getattr(settings, "SHIPROCKET_EMAIL", "")
    password = getattr(settings, "SHIPROCKET_PASSWORD", "")
    if not (email and password):
        return _demo_tracking(awb)
    try:
        import urllib.request, json as _j
        # Get token
        auth_body = _j.dumps({"email": email, "password": password}).encode()
        req = urllib.request.Request("https://apiv2.shiprocket.in/v1/external/auth/login",
                                     data=auth_body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as r:
            tok = _j.loads(r.read())["token"]
        # Track
        req2 = urllib.request.Request(
            f"https://apiv2.shiprocket.in/v1/external/courier/track/awb/{awb}",
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req2, timeout=8) as r2:
            data = _j.loads(r2.read())
        td = data.get("tracking_data", {})
        shipment_track = td.get("shipment_track", [{}])[0]
        activities = td.get("shipment_track_activities", [])
        return {
            "awb": awb,
            "source": "shiprocket",
            "carrier": shipment_track.get("courier_name", ""),
            "status": shipment_track.get("current_status", "UNKNOWN"),
            "estimated_delivery": shipment_track.get("etd", ""),
            "events": [{"timestamp": a.get("date", ""), "location": a.get("location", ""), "description": a.get("activity", "")} for a in activities[:10]],
        }
    except Exception as e:
        logger.error(f"Shiprocket tracking failed: {e}")
        return _demo_tracking(awb)


@router.get("/track/{awb}")
def track_shipment(awb: str, _: User = Depends(get_current_user)):
    return _shiprocket_tracking(awb.strip())


@router.get("/track-by-order/{order_id}")
def track_by_order(order_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    shipments = db.exec(select(Shipment).where(Shipment.order_id == order_id)).all()
    if not shipments:
        raise HTTPException(404, "No shipments found for this order")
    s = shipments[0]
    awb = s.tracking_number or f"DEMO{order_id:08d}"
    result = _shiprocket_tracking(awb)
    result["order_id"] = order_id
    result["carrier_override"] = s.carrier
    result["status_override"] = s.status
    return result


# ── Vendor Portal ─────────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    name: str
    contact: str
    email: str
    phone: str
    category: str
    lead_time_days: int = 7
    rating: float = 4.0


@router.get("/vendors")
def list_vendors(_: User = Depends(get_current_user)):
    return _VENDORS


@router.post("/vendors", status_code=201)
def create_vendor(payload: VendorCreate, _: User = Depends(require_ops)):
    global _VENDOR_SEQ
    vendor = {**payload.model_dump(), "id": _VENDOR_SEQ, "active": True}
    _VENDOR_SEQ += 1
    _VENDORS.append(vendor)
    return vendor


@router.delete("/vendors/{vendor_id}")
def deactivate_vendor(vendor_id: int, _: User = Depends(require_ops)):
    for v in _VENDORS:
        if v["id"] == vendor_id:
            v["active"] = False
            return {"ok": True}
    raise HTTPException(404, "Vendor not found")


# ── Purchase Orders ───────────────────────────────────────────────────────────

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    product_name: str
    sku: str
    quantity: int
    unit_cost: float
    notes: Optional[str] = ""


class POStatusUpdate(BaseModel):
    status: str  # PENDING | ORDERED | RECEIVED | CANCELLED


@router.get("/purchase-orders")
def list_purchase_orders(_: User = Depends(get_current_user)):
    return _PURCHASE_ORDERS


@router.post("/purchase-orders", status_code=201)
def create_purchase_order(payload: PurchaseOrderCreate, _: User = Depends(require_ops)):
    global _PO_SEQ
    vendor = next((v for v in _VENDORS if v["id"] == payload.vendor_id), None)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    lead = vendor.get("lead_time_days", 7)
    po = {
        "id": _PO_SEQ,
        "vendor_id": payload.vendor_id,
        "vendor_name": vendor["name"],
        "product_name": payload.product_name,
        "sku": payload.sku,
        "quantity": payload.quantity,
        "unit_cost": payload.unit_cost,
        "total_cost": round(payload.quantity * payload.unit_cost, 2),
        "status": "PENDING",
        "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        "expected_date": (datetime.utcnow() + timedelta(days=lead)).strftime("%Y-%m-%dT%H:%M:%S"),
        "notes": payload.notes or "",
    }
    _PO_SEQ += 1
    _PURCHASE_ORDERS.append(po)
    return po


@router.patch("/purchase-orders/{po_id}/status")
def update_po_status(po_id: int, payload: POStatusUpdate, _: User = Depends(require_ops)):
    for po in _PURCHASE_ORDERS:
        if po["id"] == po_id:
            po["status"] = payload.status
            return po
    raise HTTPException(404, "Purchase order not found")


@router.delete("/purchase-orders/{po_id}")
def delete_po(po_id: int, _: User = Depends(require_ops)):
    for i, po in enumerate(_PURCHASE_ORDERS):
        if po["id"] == po_id:
            _PURCHASE_ORDERS.pop(i)
            return {"ok": True}
    raise HTTPException(404, "Purchase order not found")


# ── Low-stock auto-PO suggestion ──────────────────────────────────────────────

@router.get("/restock-suggestions")
def restock_suggestions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Return inventory items below threshold with suggested vendor & PO quantity."""
    rows = db.exec(
        select(Product, Inventory)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(Inventory.current_stock <= Inventory.reorder_threshold)
        .where(Product.is_active == True)
        .order_by(Inventory.current_stock)
        .limit(20)
    ).all()
    suggestions = []
    for product, inv in rows:
        vendor = next((v for v in _VENDORS if v["category"].lower() in product.category.lower()), _VENDORS[0])
        suggestions.append({
            "product_id": product.id,
            "product_name": product.name,
            "sku": product.sku,
            "category": product.category,
            "current_stock": inv.current_stock,
            "reorder_threshold": inv.reorder_threshold,
            "suggested_qty": inv.reorder_quantity,
            "suggested_vendor": vendor["name"],
            "vendor_id": vendor["id"],
            "estimated_cost": round(inv.reorder_quantity * product.price * 0.65, 2),
            "urgency": "CRITICAL" if inv.current_stock == 0 else "HIGH" if inv.current_stock < inv.reorder_threshold * 0.5 else "MEDIUM",
        })
    return suggestions
