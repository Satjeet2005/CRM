from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.rbac import get_role_permissions, has_permission
from app.auth.session import validate_session
from app.config import settings
from app.db.session import get_db
from app.models.membership import OrganizationMembership
from app.models.organization import Organization
from app.models.user import User


@dataclass
class AuthenticatedContext:
    user: User
    organization: Organization
    membership: OrganizationMembership
    permissions: list[str]


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> AuthenticatedContext:
    """
    Extract and validate the server-side session from the HttpOnly cookie.
    Retrieves the user, active organization membership, and permission list.
    """
    session_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication required"},
        )

    session_record = validate_session(db, session_token)
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "SESSION_EXPIRED", "message": "Session has expired or is invalid"},
        )

    # Fetch User
    stmt_user = select(User).where(User.id == session_record.user_id, User.is_active.is_(True))
    user = db.execute(stmt_user).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_INACTIVE", "message": "User account is disabled or missing"},
        )

    # Fetch Active Membership in the Session's Organization
    stmt_mem = select(OrganizationMembership).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.organization_id == session_record.organization_id,
        OrganizationMembership.is_active.is_(True),
    )
    membership = db.execute(stmt_mem).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ORG_MEMBERSHIP_INACTIVE",
                "message": "No active membership found for organization",
            },
        )

    # Fetch Organization
    stmt_org = select(Organization).where(Organization.id == session_record.organization_id)
    org = db.execute(stmt_org).scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"},
        )

    perms = get_role_permissions(membership.role)
    return AuthenticatedContext(
        user=user,
        organization=org,
        membership=membership,
        permissions=perms,
    )


def require_permission(permission: str) -> Callable[[AuthenticatedContext], AuthenticatedContext]:
    """Dependency factory that enforces a specific permission on the authenticated user."""

    def _checker(
        ctx: AuthenticatedContext = Depends(get_current_user),
    ) -> AuthenticatedContext:
        if not has_permission(ctx.membership.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Operation requires '{permission}' permission",
                },
            )
        return ctx

    return _checker
