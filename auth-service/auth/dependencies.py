from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from auth.utils import decode_token
from database import get_db
from models import Role, User

bearer_scheme = HTTPBearer()


def _get_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token_data = decode_token(credentials.credentials)
        if token_data.token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_current_user(user: User = Depends(_get_user_from_token)) -> User:
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_manager_or_above(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.admin, Role.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin access required",
        )
    return user


def require_sme_or_above(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.admin, Role.manager, Role.sme):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SME, Manager or Admin access required",
        )
    return user
