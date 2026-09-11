"""Database initialization — creates tables and seeds default data."""
import logging
from sqlmodel import Session, select

from app.db.session import engine, create_db_and_tables
from app.models import Role, User
from app.core.security import hash_password

logger = logging.getLogger("shopmind.init_db")

DEFAULT_ROLES = [
    {"name": "ADMIN", "description": "Full system access"},
    {"name": "ANALYST", "description": "Read-only analytics access"},
    {"name": "OPS_MANAGER", "description": "Operational management access"},
    {"name": "CUSTOMER_SUPPORT", "description": "Customer support access"},
    {"name": "CUSTOMER", "description": "Customer self-service access"},
]

DEFAULT_USERS = [
    {"email": "admin@shopmind.ai", "full_name": "System Admin", "password": "Admin@123", "role": "ADMIN"},
    {"email": "ops@shopmind.ai", "full_name": "Operations Manager", "password": "Ops@1234", "role": "OPS_MANAGER"},
    {"email": "analyst@shopmind.ai", "full_name": "Business Analyst", "password": "Analyst@1", "role": "ANALYST"},
    {"email": "support@shopmind.ai", "full_name": "Support Agent", "password": "Support@1", "role": "CUSTOMER_SUPPORT"},
    {"email": "customer@shopmind.ai", "full_name": "Demo Customer", "password": "Customer@1", "role": "CUSTOMER"},
]


def init_db():
    logger.info("Initializing database...")
    create_db_and_tables()

    with Session(engine) as db:
        # Seed roles
        role_map = {}
        for role_data in DEFAULT_ROLES:
            existing = db.exec(select(Role).where(Role.name == role_data["name"])).first()
            if not existing:
                role = Role(**role_data)
                db.add(role)
                db.flush()
                role_map[role_data["name"]] = role
                logger.info(f"  Created role: {role_data['name']}")
            else:
                role_map[role_data["name"]] = existing

        db.commit()

        # Refresh role_map after commit
        for name in list(role_map.keys()):
            role_map[name] = db.exec(select(Role).where(Role.name == name)).first()

        # Seed users
        for u in DEFAULT_USERS:
            existing = db.exec(select(User).where(User.email == u["email"])).first()
            if not existing:
                role = role_map.get(u["role"])
                if role:
                    user = User(
                        email=u["email"],
                        full_name=u["full_name"],
                        hashed_password=hash_password(u["password"]),
                        role_id=role.id,
                    )
                    db.add(user)
                    logger.info(f"  Created user: {u['email']} ({u['role']})")

        db.commit()

    logger.info("Database initialization complete.")
