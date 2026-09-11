import logging
from typing import Optional, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session

from app.core.security import decode_token
from app.db.session import engine

logger = logging.getLogger("shopmind.deps")
bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    from app.models import User

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(*roles: str):
    def _check(user=Depends(get_current_user)):
        if user.role.name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {roles}",
            )
        return user
    return _check


def require_admin(user=Depends(get_current_user)):
    if user.role.name != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_ops(user=Depends(get_current_user)):
    """Allow ADMIN, ANALYST, OPS_MANAGER roles."""
    allowed = {"ADMIN", "ANALYST", "OPS_MANAGER"}
    if user.role.name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operations access required")
    return user


def require_support(user=Depends(get_current_user)):
    allowed = {"ADMIN", "CUSTOMER_SUPPORT", "OPS_MANAGER"}
    if user.role.name not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Support access required")
    return user
