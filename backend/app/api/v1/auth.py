"""Auth API routes."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.services.auth_service import auth_service
from app.models import User

logger = logging.getLogger("shopmind.api.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.register(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
