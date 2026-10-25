from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.csrf import generate_csrf_token, is_origin_allowed, verify_csrf
from app.auth.dependencies import AuthenticatedContext, get_current_user
from app.auth.password import verify_password
from app.auth.rate_limit import is_rate_limited, record_failed_attempt, record_successful_attempt
from app.auth.session import create_session, hash_session_token
from app.config import settings
from app.db.session import get_db
from app.models.membership import OrganizationMembership
from app.models.organization import Organization
from app.models.session import SessionModel
from app.models.user import User
from app.schemas.auth import (
    AuthMeResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    OrganizationSummary,
    UserProfile,
)
from app.schemas.errors import ErrorResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
        403: {"model": ErrorResponse, "description": "CSRF validation failed"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    client_ip = request.client.host if request.client else "127.0.0.1"
    normalized_email = payload.email.strip().lower()

    # 1. CSRF Verification for state-changing requests
    # If the client already possesses a CSRF cookie, require full double-submit token validation.
    # If no CSRF cookie exists yet (first login in session), enforce strict Origin/Referer verification.
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin and not is_origin_allowed(origin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "CSRF_ERROR",
                "message": "Origin not allowed for login request",
            },
        )
    if request.cookies.get(settings.CSRF_COOKIE_NAME):
        if not verify_csrf(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "CSRF_ERROR",
                    "message": "CSRF validation failed for mutation request",
                },
            )

    # 2. Rate Limiting Check
    if is_rate_limited(client_ip, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many failed login attempts. Please wait before retrying.",
            },
        )

    # 3. Lookup user
    stmt_user = select(User).where(User.email_normalized == normalized_email)
    user = db.execute(stmt_user).scalar_one_or_none()

    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        record_failed_attempt(client_ip, normalized_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
        )

    # 4. Lookup organization membership
    stmt_mem = select(OrganizationMembership).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.is_active.is_(True),
    )
    membership = db.execute(stmt_mem).scalar_one_or_none()
    if not membership:
        record_failed_attempt(client_ip, normalized_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "NO_ACTIVE_MEMBERSHIP",
                "message": "User has no active organization membership",
            },
        )

    # 5. Lookup organization details
    stmt_org = select(Organization).where(Organization.id == membership.organization_id)
    org = db.execute(stmt_org).scalar_one_or_none()
    if not org:
        record_failed_attempt(client_ip, normalized_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"},
        )

    record_successful_attempt(client_ip, normalized_email)

    # 6. Create opaque session
    user_agent = request.headers.get("user-agent")
    raw_session_token, _ = create_session(
        db,
        user_id=user.id,
        organization_id=org.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # 7. Generate fresh CSRF token
    csrf_token = generate_csrf_token()

    # 8. Set HttpOnly session cookie and readable CSRF cookie
    cookie_ttl_seconds = settings.SESSION_TTL_HOURS * 3600
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_session_token,
        max_age=cookie_ttl_seconds,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings.cookie_secure,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=cookie_ttl_seconds,
        httponly=False,  # Client JS can read to send in X-CSRF-Token header
        samesite="lax",
        path="/",
        secure=settings.cookie_secure,
    )

    from app.auth.rbac import get_role_permissions

    profile = UserProfile(
        id=user.id,
        email=user.email_normalized,
        display_name=user.display_name,
        role=membership.role,
        organization=OrganizationSummary(
            id=org.id,
            name=org.name,
            slug=org.slug,
            currency=org.currency,
            timezone=org.timezone,
        ),
        permissions=get_role_permissions(membership.role),
    )
    return LoginResponse(user=profile)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    responses={
        403: {"model": ErrorResponse, "description": "CSRF validation failed"},
    },
)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LogoutResponse:
    # CSRF check on mutating logout
    if not verify_csrf(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CSRF_ERROR", "message": "CSRF validation failed for logout"},
        )

    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        token_hash = hash_session_token(token)
        stmt = select(SessionModel).where(SessionModel.token_hash == token_hash)
        session_record = db.execute(stmt).scalar_one_or_none()
        if session_record:
            from datetime import datetime, timezone

            session_record.revoked_at = datetime.now(timezone.utc)
            db.commit()

    # Clear cookies
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")
    return LogoutResponse(message="Logged out successfully")


@router.get(
    "/me",
    response_model=AuthMeResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
    },
)
def get_me(
    ctx: AuthenticatedContext = Depends(get_current_user),
) -> AuthMeResponse:
    profile = UserProfile(
        id=ctx.user.id,
        email=ctx.user.email_normalized,
        display_name=ctx.user.display_name,
        role=ctx.membership.role,
        organization=OrganizationSummary(
            id=ctx.organization.id,
            name=ctx.organization.name,
            slug=ctx.organization.slug,
            currency=ctx.organization.currency,
            timezone=ctx.organization.timezone,
        ),
        permissions=ctx.permissions,
    )
    return AuthMeResponse(user=profile)
