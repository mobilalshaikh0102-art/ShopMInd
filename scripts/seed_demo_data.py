"""Demo data seeder for ShopMind — creates a rich dataset for all models."""
import sys
import os
import json
import random
import string
import time
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlmodel import Session
from app.db.session import engine, create_db_and_tables
from app.db.init_db import init_db
from app.models import (
    Customer, Product, Inventory, Order, OrderItem, Shipment, SupportTicket,
    AgentExecution, AuditLog, KnowledgeDocument, User, Role,
    OrderStatus, ShipmentStatus, TicketStatus, TicketPriority, RiskLevel,
)
from app.core.security import hash_password

# ─── Sample data ──────────────────────────────────────────────────────────────

CATEGORIES = ["Electronics", "Clothing", "Home & Kitchen", "Beauty", "Sports", "Books", "Toys", "Food"]

PRODUCTS_DATA = [
    {"sku": "ELEC-001", "name": "Wireless Noise-Cancelling Headphones", "category": "Electronics", "price": 4999, "cost_price": 2200, "brand": "SoundPro"},
    {"sku": "ELEC-002", "name": "Smart Watch Pro X1", "category": "Electronics", "price": 8999, "cost_price": 4000, "brand": "TechWear"},
    {"sku": "ELEC-003", "name": "Portable Bluetooth Speaker", "category": "Electronics", "price": 2499, "cost_price": 900, "brand": "BassMax"},
    {"sku": "ELEC-004", "name": "Mechanical Gaming Keyboard", "category": "Electronics", "price": 3499, "cost_price": 1400, "brand": "KeyMaster"},
    {"sku": "ELEC-005", "name": "4K Webcam Ultra HD", "category": "Electronics", "price": 6999, "cost_price": 3100, "brand": "VisionPro"},
    {"sku": "CLTH-001", "name": "Men's Performance Running Jacket", "category": "Clothing", "price": 1999, "cost_price": 700, "brand": "FlexFit"},
    {"sku": "CLTH-002", "name": "Women's Yoga Pants - Premium", "category": "Clothing", "price": 1499, "cost_price": 500, "brand": "ZenWear"},
    {"sku": "CLTH-003", "name": "Unisex Oversized Hoodie", "category": "Clothing", "price": 1299, "cost_price": 480, "brand": "ComfyLife"},
    {"sku": "HOME-001", "name": "Stainless Steel Pressure Cooker 5L", "category": "Home & Kitchen", "price": 2999, "cost_price": 1100, "brand": "CookMaster"},
    {"sku": "HOME-002", "name": "Smart Air Purifier with HEPA Filter", "category": "Home & Kitchen", "price": 12999, "cost_price": 5500, "brand": "PureAir"},
    {"sku": "HOME-003", "name": "Bamboo Chopping Board Set (3-piece)", "category": "Home & Kitchen", "price": 799, "cost_price": 250, "brand": "NaturaCook"},
    {"sku": "BEAU-001", "name": "Vitamin C Brightening Serum 30ml", "category": "Beauty", "price": 1299, "cost_price": 300, "brand": "GlowLab"},
    {"sku": "BEAU-002", "name": "Hyaluronic Acid Moisturizer SPF50", "category": "Beauty", "price": 999, "cost_price": 280, "brand": "SkinFirst"},
    {"sku": "SPRT-001", "name": "Professional Yoga Mat with Alignment Lines", "category": "Sports", "price": 2499, "cost_price": 800, "brand": "ZenSport"},
    {"sku": "SPRT-002", "name": "Adjustable Dumbbell Set 5-25kg", "category": "Sports", "price": 8499, "cost_price": 3200, "brand": "IronFlex"},
    {"sku": "BOOK-001", "name": "The AI Revolution: Business Transformation Guide", "category": "Books", "price": 599, "cost_price": 150, "brand": "TechPress"},
    {"sku": "BOOK-002", "name": "Python for Data Science - 3rd Edition", "category": "Books", "price": 799, "cost_price": 200, "brand": "CodeBooks"},
    {"sku": "TOYS-001", "name": "STEM Robot Building Kit for Kids 8+", "category": "Toys", "price": 3499, "cost_price": 1200, "brand": "RoboKids"},
    {"sku": "FOOD-001", "name": "Organic Green Tea Collection (50 bags)", "category": "Food", "price": 499, "cost_price": 150, "brand": "NaturaBrew"},
    {"sku": "FOOD-002", "name": "Premium Dark Chocolate Assorted Box 500g", "category": "Food", "price": 899, "cost_price": 320, "brand": "ChocoLux"},
]

CUSTOMERS_DATA = [
    {"name": "Priya Sharma", "email": "priya.sharma@gmail.com", "phone": "+91-9876543210", "city": "Mumbai", "state": "Maharashtra"},
    {"name": "Arjun Mehta", "email": "arjun.mehta@outlook.com", "phone": "+91-9988776655", "city": "Bengaluru", "state": "Karnataka"},
    {"name": "Sneha Iyer", "email": "sneha.iyer@yahoo.com", "phone": "+91-7654321098", "city": "Chennai", "state": "Tamil Nadu"},
    {"name": "Rahul Gupta", "email": "rahul.gupta@gmail.com", "phone": "+91-8765432109", "city": "Delhi", "state": "Delhi"},
    {"name": "Kavya Nair", "email": "kavya.nair@gmail.com", "phone": "+91-9123456789", "city": "Kochi", "state": "Kerala"},
    {"name": "Vikram Singh", "email": "vikram.singh@corporate.com", "phone": "+91-9012345678", "city": "Chandigarh", "state": "Punjab"},
    {"name": "Meera Patel", "email": "meera.patel@gmail.com", "phone": "+91-8901234567", "city": "Ahmedabad", "state": "Gujarat"},
    {"name": "Aditya Kumar", "email": "aditya.kumar@hotmail.com", "phone": "+91-7890123456", "city": "Patna", "state": "Bihar"},
    {"name": "Divya Reddy", "email": "divya.reddy@gmail.com", "phone": "+91-9234567890", "city": "Hyderabad", "state": "Telangana"},
    {"name": "Rohan Joshi", "email": "rohan.joshi@gmail.com", "phone": "+91-9345678901", "city": "Pune", "state": "Maharashtra"},
    {"name": "Ananya Bose", "email": "ananya.bose@gmail.com", "phone": "+91-9456789012", "city": "Kolkata", "state": "West Bengal"},
    {"name": "Siddharth Verma", "email": "sid.verma@techcorp.in", "phone": "+91-9567890123", "city": "Noida", "state": "Uttar Pradesh"},
]

ORDER_STATUSES = [
    OrderStatus.PENDING, OrderStatus.PENDING, OrderStatus.PROCESSING,
    OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.DELIVERED,
    OrderStatus.CANCELLED, OrderStatus.REFUNDED,
]

SHIPMENT_STATUSES = [
    ShipmentStatus.DELAYED, ShipmentStatus.IN_TRANSIT,
]

CARRIERS = ["Blue Dart", "Delhivery", "Ekart", "DTDC", "XpressBees", "Amazon Logistics"]

TICKET_SUBJECTS = [
    "Order not delivered on time",
    "Received damaged product",
    "Requesting refund for cancelled order",
    "Product quality issue - item differs from description",
    "Wrong item delivered",
    "Exchange request for different size",
    "Tracking number not working",
    "Duplicate charge on my account",
    "Return pickup not scheduled",
    "EMI not applied correctly",
]

AGENT_NAMES = ["Inventory Agent", "Order Agent", "Support Agent", "Pricing Agent", "Logistics Agent", "Marketing Agent", "Analytics Agent"]
TRIGGER_EVENTS = ["STOCK_LOW", "ORDER_CREATED", "SHIPMENT_DELAYED", "USER_CHAT", "PRICE_CHANGE_REQUESTED", "SUPPORT_TICKET_CREATED", "SCHEDULED_ANALYTICS"]


def rnd_order_number():
    return "ORD-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def seed(db: Session):
    print("🌱 Seeding ShopMind demo database...")

    # Products
    print("  📦 Creating products...")
    product_objs = []
    for pd in PRODUCTS_DATA:
        from sqlmodel import select
        existing = db.exec(select(Product).where(Product.sku == pd["sku"])).first()
        if not existing:
            product = Product(
                sku=pd["sku"], name=pd["name"], category=pd["category"],
                description=f"Premium quality {pd['name']} from {pd['brand']}. Trusted by thousands of customers.",
                price=float(pd["price"]), cost_price=float(pd["cost_price"]),
                brand=pd.get("brand"), currency="INR", weight_kg=round(random.uniform(0.2, 5.0), 2),
            )
            db.add(product)
            db.flush()
            # Inventory
            inv = Inventory(
                product_id=product.id,
                current_stock=random.randint(0, 150),
                reserved_stock=random.randint(0, 20),
                reorder_threshold=random.randint(10, 30),
                reorder_quantity=random.randint(20, 80),
                sales_velocity_30d=round(random.uniform(2, 40), 2),
                warehouse_location=f"WH-{random.choice(['A','B','C'])}-{random.randint(1,20):02d}",
            )
            db.add(inv)
            product_objs.append(product)
        else:
            product_objs.append(existing)
    db.commit()
    print(f"    ✓ {len(product_objs)} products with inventory")

    # Refresh product_objs
    from sqlmodel import select
    product_objs = list(db.exec(select(Product)).all())

    # Customers
    print("  👥 Creating customers...")
    customer_objs = []
    for cd in CUSTOMERS_DATA:
        existing = db.exec(select(Customer).where(Customer.email == cd["email"])).first()
        if not existing:
            c = Customer(
                name=cd["name"], email=cd["email"], phone=cd.get("phone"),
                city=cd.get("city"), state=cd.get("state"), country="India",
                pincode=str(random.randint(110001, 799999)),
                address=f"{random.randint(1, 999)}, {cd.get('city')} Street",
            )
            db.add(c)
            db.flush()
            customer_objs.append(c)
        else:
            customer_objs.append(existing)
    db.commit()
    customer_objs = list(db.exec(select(Customer)).all())
    print(f"    ✓ {len(customer_objs)} customers")

    # Orders
    print("  🛒 Creating orders...")
    order_count = 0
    for i in range(35):
        customer = random.choice(customer_objs)
        num_items = random.randint(1, 4)
        selected_products = random.sample(product_objs, min(num_items, len(product_objs)))
        order_status = random.choice(ORDER_STATUSES)
        days_ago = random.randint(0, 90)
        created = datetime.now(timezone.utc) - timedelta(days=days_ago)

        order = Order(
            order_number=rnd_order_number(),
            customer_id=customer.id,
            status=order_status,
            shipping_address=f"{customer.address}, {customer.city} - {customer.pincode or '110001'}",
            currency="INR",
            created_at=created,
        )
        db.add(order)
        db.flush()

        subtotal = 0.0
        for product in selected_products:
            qty = random.randint(1, 3)
            total_p = product.price * qty
            subtotal += total_p
            item = OrderItem(order_id=order.id, product_id=product.id, quantity=qty, unit_price=product.price, total_price=total_p)
            db.add(item)

        tax = round(subtotal * 0.18, 2)
        shipping = 0.0 if subtotal > 500 else 50.0
        order.subtotal = round(subtotal, 2)
        order.tax = tax
        order.shipping_fee = shipping
        order.total = round(subtotal + tax + shipping, 2)
        db.add(order)
        order_count += 1

        # Shipments for shipped/delivered/cancelled orders
        if order_status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
            ship_status = ShipmentStatus.DELIVERED if order_status == OrderStatus.DELIVERED else random.choice([ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELAYED])
            shipment = Shipment(
                order_id=order.id,
                tracking_number="TRK" + "".join(random.choices(string.digits, k=10)),
                carrier=random.choice(CARRIERS),
                status=ship_status,
                shipped_at=created + timedelta(days=1),
                estimated_delivery=created + timedelta(days=random.randint(3, 7)),
                actual_delivery=(created + timedelta(days=5)) if ship_status == ShipmentStatus.DELIVERED else None,
                delay_reason="Weather disruption in transit hub" if ship_status == ShipmentStatus.DELAYED else None,
            )
            db.add(shipment)

    db.commit()
    print(f"    ✓ {order_count} orders with shipments")

    # Support Tickets
    print("  🎫 Creating support tickets...")
    ticket_statuses = [TicketStatus.OPEN, TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED]
    ticket_priorities = [TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.MEDIUM, TicketPriority.LOW, TicketPriority.URGENT]
    for i in range(15):
        customer = random.choice(customer_objs)
        t_status = random.choice(ticket_statuses)
        created = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
        ticket = SupportTicket(
            customer_id=customer.id,
            subject=random.choice(TICKET_SUBJECTS),
            description="Customer complaint regarding order. Needs immediate attention and resolution.",
            priority=random.choice(ticket_priorities),
            status=t_status,
            assigned_to="support@shopmind.ai" if t_status != TicketStatus.OPEN else None,
            resolution_notes="Issue resolved after investigation." if t_status in [TicketStatus.RESOLVED, TicketStatus.CLOSED] else None,
            created_at=created,
        )
        db.add(ticket)
    db.commit()
    print("    ✓ 15 support tickets")

    # Agent Executions
    print("  🤖 Creating agent execution history...")
    for i in range(20):
        agent = random.choice(AGENT_NAMES)
        event = random.choice(TRIGGER_EVENTS)
        started = datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 168))
        exec_time = random.randint(800, 8000)
        exec_status = random.choices(["COMPLETED", "FAILED"], weights=[9, 1])[0]
        execution = AgentExecution(
            trace_id="".join(random.choices(string.hexdigits, k=32)),
            session_id=f"sess_{random.randint(1000, 9999)}",
            agent_name=agent,
            trigger_event=event,
            input_payload=json.dumps({"source": "demo_seed"}),
            output_summary="Agent completed analysis and generated recommendations.",
            status=exec_status,
            execution_time_ms=exec_time,
            started_at=started,
            completed_at=started + timedelta(milliseconds=exec_time),
        )
        db.add(execution)
    db.commit()
    print("    ✓ 20 agent executions")

    # Audit Logs
    print("  📋 Creating audit logs...")
    audit_actions = [
        ("admin@shopmind.ai", "USER_LOGIN", "User", None, "LOW"),
        ("ops@shopmind.ai", "ORDER_STATUS_UPDATED", "Order", None, "LOW"),
        ("InventoryAgent", "RESTOCK_EXECUTED", "Inventory", None, "LOW"),
        ("PricingAgent", "PRICE_CHANGE_PROPOSED", "Product", None, "HIGH"),
        ("ops@shopmind.ai", "APPROVAL_APPROVED", "Approval", None, "HIGH"),
        ("support@shopmind.ai", "TICKET_ASSIGNED", "SupportTicket", None, "LOW"),
        ("LogisticsAgent", "DELAY_DETECTED", "Shipment", None, "MEDIUM"),
        ("admin@shopmind.ai", "USER_CREATED", "User", None, "MEDIUM"),
    ]
    for actor, action, entity, entity_id, risk in audit_actions:
        log = AuditLog(
            actor=actor, action=action, entity_type=entity,
            entity_id=entity_id or random.randint(1, 20),
            risk_level=risk, result="success",
            timestamp=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 48)),
            trace_id="trace_" + "".join(random.choices(string.hexdigits, k=12)),
        )
        db.add(log)
    db.commit()
    print("    ✓ 8 audit log entries")

    print("\n✅ Demo data seeded successfully!")
    print(f"   Products: {len(product_objs)}")
    print(f"   Customers: {len(customer_objs)}")
    print(f"   Orders: {order_count}")
    print(f"   Support Tickets: 15")
    print(f"   Agent Executions: 20")
    print(f"   Audit Logs: 8")


if __name__ == "__main__":
    print("🔧 Initializing database...")
    init_db()
    with Session(engine) as db:
        seed(db)
