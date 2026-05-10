from pydantic import BaseModel, EmailStr
from models import Role


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Role = Role.sme


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: Role
    is_active: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    email: str
    role: Role
    token_type: str  # "access" or "refresh"
