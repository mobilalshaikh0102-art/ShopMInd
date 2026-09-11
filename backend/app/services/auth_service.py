"""Auth service — login, registration, token management."""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from app.core.security import hash_password, verify_password, create_access_token
from app.models import User, Role, Customer
from app.schemas import LoginRequest, RegisterRequest, TokenResponse

logger = logging.getLogger("shopmind.auth")


class AuthService:
    def login(self, db: Session, request: LoginRequest) -> TokenResponse:
        user = db.exec(select(User).where(User.email == request.email)).first()
        if not user or not verify_password(request.password, user.hashed_password):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is deactivated")

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        db.add(user)
        db.commit()

        token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.name})
        return TokenResponse(
            access_token=token,
            role=user.role.name,
            user_id=user.id,
            full_name=user.full_name,
        )

    def register(self, db: Session, request: RegisterRequest) -> User:
        existing = db.exec(select(User).where(User.email == request.email)).first()
        if existing:
            raise ValueError("Email already registered")

        role = db.exec(select(Role).where(Role.name == request.role_name)).first()
        if not role:
            raise ValueError(f"Role '{request.role_name}' not found")

        user = User(
            email=request.email,
            full_name=request.full_name,
            hashed_password=hash_password(request.password),
            role_id=role.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def get_user_by_id(self, db: Session, user_id: int) -> Optional[User]:
        return db.get(User, user_id)


auth_service = AuthService()
