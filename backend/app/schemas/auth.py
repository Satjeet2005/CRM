import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="Plaintext password")


class OrganizationSummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    currency: str
    timezone: str


class UserProfile(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    organization: OrganizationSummary
    permissions: list[str]


class AuthMeResponse(BaseModel):
    user: UserProfile


class LoginResponse(BaseModel):
    user: UserProfile


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully"
