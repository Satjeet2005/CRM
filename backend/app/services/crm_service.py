import math
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.models.crm import Account, Contact, Opportunity, Task
from app.models.user import User
from app.schemas.crm import (
    AccountCreate,
    AccountResponse,
    AccountUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    OpportunityCreate,
    OpportunityReopenRequest,
    OpportunityResponse,
    OpportunityStageUpdate,
    OpportunityUpdate,
    PaginatedResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.services.activity_service import record_activity

# ==================== Account Operations ====================


def list_accounts(
    db: Session,
    ctx: AuthenticatedContext,
    search: Optional[str] = None,
    account_type: Optional[str] = None,
    status_filter: Optional[str] = "active",
    owner_id: Optional[uuid.UUID] = None,
    industry: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[AccountResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(Account).where(Account.organization_id == ctx.organization.id)

    if status_filter:
        query = query.where(Account.status == status_filter)
    if account_type:
        query = query.where(Account.account_type == account_type)
    if owner_id:
        query = query.where(Account.owner_user_id == owner_id)
    if industry:
        query = query.where(Account.industry == industry)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Account.name.ilike(search_pattern),
                Account.legal_name.ilike(search_pattern),
                Account.email.ilike(search_pattern),
                Account.phone.ilike(search_pattern),
            )
        )

    # Count total
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    # Fetch items with owner
    query = (
        query.options(selectinload(Account.owner))
        .order_by(Account.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    accounts = db.execute(query).scalars().all()

    # Pre-fetch counts for contacts and opportunities
    acc_ids = [a.id for a in accounts]
    contacts_counts: dict[uuid.UUID, int] = {}
    opps_counts: dict[uuid.UUID, int] = {}
    if acc_ids:
        c_stmt = (
            select(Contact.account_id, func.count(Contact.id))
            .where(Contact.account_id.in_(acc_ids), Contact.status == "active")
            .group_by(Contact.account_id)
        )
        for aid, cnt in db.execute(c_stmt).all():
            contacts_counts[aid] = cnt

        o_stmt = (
            select(Opportunity.account_id, func.count(Opportunity.id))
            .where(Opportunity.account_id.in_(acc_ids))
            .group_by(Opportunity.account_id)
        )
        for aid, cnt in db.execute(o_stmt).all():
            opps_counts[aid] = cnt

    items = []
    for a in accounts:
        resp = AccountResponse.model_validate(a)
        resp.owner_name = a.owner.display_name if a.owner else None
        resp.contacts_count = contacts_counts.get(a.id, 0)
        resp.opportunities_count = opps_counts.get(a.id, 0)
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def create_account(
    db: Session,
    ctx: AuthenticatedContext,
    payload: AccountCreate,
) -> AccountResponse:
    # Validate owner belongs to the same organization
    if payload.owner_user_id:
        owner = db.execute(
            select(User).where(User.id == payload.owner_user_id, User.is_active.is_(True))
        ).scalar_one_or_none()
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_OWNER",
                    "message": "Assigned owner does not exist or is inactive",
                },
            )

    account = Account(
        organization_id=ctx.organization.id,
        name=payload.name,
        legal_name=payload.legal_name,
        account_type=payload.account_type,
        industry=payload.industry,
        website=payload.website,
        phone=payload.phone,
        email=payload.email,
        billing_address_json=payload.billing_address_json,
        shipping_address_json=payload.shipping_address_json,
        notes=payload.notes,
        owner_user_id=payload.owner_user_id or ctx.user.id,
        created_by=ctx.user.id,
        status="active",
        version=1,
    )
    db.add(account)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="account",
        entity_id=account.id,
        event_type="account_created",
        summary=f"Account '{account.name}' created by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(account)

    resp = AccountResponse.model_validate(account)
    if account.owner:
        resp.owner_name = account.owner.display_name
    return resp


def get_account_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: uuid.UUID,
) -> Account:
    stmt = (
        select(Account)
        .where(Account.id == account_id, Account.organization_id == ctx.organization.id)
        .options(selectinload(Account.owner))
    )
    account = db.execute(stmt).scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ACCOUNT_NOT_FOUND", "message": "Account not found or inaccessible"},
        )
    return account


def update_account(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: uuid.UUID,
    payload: AccountUpdate,
) -> AccountResponse:
    account = get_account_or_404(db, ctx, account_id)

    # Optimistic concurrency check
    if account.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Account version conflict. Expected {payload.expected_version}, current is {account.version}.",
                "current_version": account.version,
            },
        )

    # Validate owner if updated
    if payload.owner_user_id and payload.owner_user_id != account.owner_user_id:
        owner = db.execute(
            select(User).where(User.id == payload.owner_user_id, User.is_active.is_(True))
        ).scalar_one_or_none()
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_OWNER",
                    "message": "Assigned owner does not exist or is inactive",
                },
            )
        account.owner_user_id = payload.owner_user_id

    update_data = payload.model_dump(
        exclude_unset=True, exclude={"expected_version", "owner_user_id"}
    )
    for field, val in update_data.items():
        setattr(account, field, val)

    account.version += 1
    account.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="account",
        entity_id=account.id,
        event_type="account_updated",
        summary=f"Account '{account.name}' updated by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(account)

    resp = AccountResponse.model_validate(account)
    if account.owner:
        resp.owner_name = account.owner.display_name
    return resp


def archive_account(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: uuid.UUID,
    expected_version: int,
) -> AccountResponse:
    account = get_account_or_404(db, ctx, account_id)

    if account.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Account version conflict. Expected {expected_version}, current is {account.version}.",
                "current_version": account.version,
            },
        )

    account.status = "archived"
    account.version += 1
    account.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="account",
        entity_id=account.id,
        event_type="account_archived",
        summary=f"Account '{account.name}' archived by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(account)

    resp = AccountResponse.model_validate(account)
    if account.owner:
        resp.owner_name = account.owner.display_name
    return resp


# ==================== Contact Operations ====================


def list_contacts(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = "active",
    is_primary: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[ContactResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(Contact).where(Contact.organization_id == ctx.organization.id)
    if account_id:
        query = query.where(Contact.account_id == account_id)
    if status_filter:
        query = query.where(Contact.status == status_filter)
    if is_primary is not None:
        query = query.where(Contact.is_primary == is_primary)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Contact.first_name.ilike(search_pattern),
                Contact.last_name.ilike(search_pattern),
                Contact.email.ilike(search_pattern),
                Contact.phone.ilike(search_pattern),
                Contact.job_title.ilike(search_pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(selectinload(Contact.account))
        .order_by(Contact.is_primary.desc(), Contact.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    contacts = db.execute(query).scalars().all()

    items = []
    for c in contacts:
        resp = ContactResponse.model_validate(c)
        resp.account_name = c.account.name if c.account else None
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def create_contact(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: uuid.UUID,
    payload: ContactCreate,
) -> ContactResponse:
    # Verify account exists in organization and is active
    account = get_account_or_404(db, ctx, account_id)
    if account.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ACCOUNT_ARCHIVED",
                "message": "Cannot add contacts to an archived account",
            },
        )

    # If is_primary is True, demote any existing primary contact atomically
    if payload.is_primary:
        db.execute(
            update(Contact)
            .where(
                Contact.account_id == account_id,
                Contact.is_primary.is_(True),
            )
            .values(
                is_primary=False,
                version=Contact.version + 1,
                updated_at=datetime.now(timezone.utc),
            )
        )
        db.flush()

    contact = Contact(
        organization_id=ctx.organization.id,
        account_id=account_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        job_title=payload.job_title,
        email=payload.email,
        phone=payload.phone,
        is_primary=payload.is_primary,
        notes=payload.notes,
        status="active",
        created_by=ctx.user.id,
        version=1,
    )
    db.add(contact)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="contact",
        entity_id=contact.id,
        event_type="contact_created",
        summary=f"Contact '{contact.first_name} {contact.last_name}' added to {account.name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(contact)

    resp = ContactResponse.model_validate(contact)
    resp.account_name = account.name
    return resp


def get_contact_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    contact_id: uuid.UUID,
) -> Contact:
    stmt = (
        select(Contact)
        .where(Contact.id == contact_id, Contact.organization_id == ctx.organization.id)
        .options(selectinload(Contact.account))
    )
    contact = db.execute(stmt).scalar_one_or_none()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONTACT_NOT_FOUND", "message": "Contact not found or inaccessible"},
        )
    return contact


def update_contact(
    db: Session,
    ctx: AuthenticatedContext,
    contact_id: uuid.UUID,
    payload: ContactUpdate,
) -> ContactResponse:
    contact = get_contact_or_404(db, ctx, contact_id)

    if contact.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Contact version conflict. Expected {payload.expected_version}, current is {contact.version}.",
                "current_version": contact.version,
            },
        )

    # Atomically demote other primaries if is_primary changed to True
    if payload.is_primary is True and not contact.is_primary:
        db.execute(
            update(Contact)
            .where(
                Contact.account_id == contact.account_id,
                Contact.is_primary.is_(True),
                Contact.id != contact.id,
            )
            .values(
                is_primary=False,
                version=Contact.version + 1,
                updated_at=datetime.now(timezone.utc),
            )
        )
        db.flush()

    update_data = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    for field, val in update_data.items():
        setattr(contact, field, val)

    contact.version += 1
    contact.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="contact",
        entity_id=contact.id,
        event_type="contact_updated",
        summary=f"Contact '{contact.first_name} {contact.last_name}' updated by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(contact)

    resp = ContactResponse.model_validate(contact)
    resp.account_name = contact.account.name if contact.account else None
    return resp


def archive_contact(
    db: Session,
    ctx: AuthenticatedContext,
    contact_id: uuid.UUID,
    expected_version: int,
) -> ContactResponse:
    contact = get_contact_or_404(db, ctx, contact_id)

    if contact.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Contact version conflict. Expected {expected_version}, current is {contact.version}.",
                "current_version": contact.version,
            },
        )

    contact.status = "archived"
    contact.is_primary = False
    contact.version += 1
    contact.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="contact",
        entity_id=contact.id,
        event_type="contact_archived",
        summary=f"Contact '{contact.first_name} {contact.last_name}' archived by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(contact)

    resp = ContactResponse.model_validate(contact)
    resp.account_name = contact.account.name if contact.account else None
    return resp


# ==================== Opportunity Operations ====================

VALID_STAGE_TRANSITIONS: dict[str, list[str]] = {
    "lead": ["qualified", "lost"],
    "qualified": ["solutioning", "lost"],
    "solutioning": ["proposal", "lost"],
    "proposal": ["negotiation", "lost"],
    "negotiation": ["won", "lost"],
    "won": [],  # terminal
    "lost": [],  # terminal
}


def list_opportunities(
    db: Session,
    ctx: AuthenticatedContext,
    account_id: Optional[uuid.UUID] = None,
    stage: Optional[str] = None,
    owner_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[OpportunityResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(Opportunity).where(Opportunity.organization_id == ctx.organization.id)
    if account_id:
        query = query.where(Opportunity.account_id == account_id)
    if stage:
        query = query.where(Opportunity.stage == stage)
    if owner_id:
        query = query.where(Opportunity.owner_user_id == owner_id)
    if from_date:
        query = query.where(Opportunity.expected_close_date >= from_date)
    if to_date:
        query = query.where(Opportunity.expected_close_date <= to_date)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(Opportunity.name.ilike(search_pattern))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(
            selectinload(Opportunity.account),
            selectinload(Opportunity.primary_contact),
            selectinload(Opportunity.owner),
        )
        .order_by(Opportunity.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    opps = db.execute(query).scalars().all()

    items = []
    for o in opps:
        resp = OpportunityResponse.model_validate(o)
        resp.account_name = o.account.name if o.account else None
        if o.primary_contact:
            resp.primary_contact_name = (
                f"{o.primary_contact.first_name} {o.primary_contact.last_name}"
            )
        resp.owner_name = o.owner.display_name if o.owner else None
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def create_opportunity(
    db: Session,
    ctx: AuthenticatedContext,
    payload: OpportunityCreate,
) -> OpportunityResponse:
    account = get_account_or_404(db, ctx, payload.account_id)
    if account.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ACCOUNT_ARCHIVED",
                "message": "Cannot create opportunity for an archived account",
            },
        )

    if payload.primary_contact_id:
        contact = db.execute(
            select(Contact).where(
                Contact.id == payload.primary_contact_id,
                Contact.account_id == account.id,
                Contact.organization_id == ctx.organization.id,
            )
        ).scalar_one_or_none()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_CONTACT",
                    "message": "Primary contact must belong to the opportunity account",
                },
            )

    owner_id = payload.owner_user_id or ctx.user.id
    opp = Opportunity(
        organization_id=ctx.organization.id,
        account_id=payload.account_id,
        primary_contact_id=payload.primary_contact_id,
        name=payload.name,
        description=payload.description,
        stage=payload.stage,
        estimated_value=payload.estimated_value,
        currency_code="INR",
        probability_percent=payload.probability_percent,
        expected_close_date=payload.expected_close_date,
        owner_user_id=owner_id,
        source=payload.source,
        created_by=ctx.user.id,
        version=1,
    )
    db.add(opp)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="opportunity",
        entity_id=opp.id,
        event_type="opportunity_created",
        summary=f"Opportunity '{opp.name}' (₹{opp.estimated_value:,.2f}) created by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(opp)

    resp = OpportunityResponse.model_validate(opp)
    resp.account_name = account.name
    return resp


def get_opportunity_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    opp_id: uuid.UUID,
) -> Opportunity:
    stmt = (
        select(Opportunity)
        .where(Opportunity.id == opp_id, Opportunity.organization_id == ctx.organization.id)
        .options(
            selectinload(Opportunity.account),
            selectinload(Opportunity.primary_contact),
            selectinload(Opportunity.owner),
        )
    )
    opp = db.execute(stmt).scalar_one_or_none()
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "OPPORTUNITY_NOT_FOUND",
                "message": "Opportunity not found or inaccessible",
            },
        )
    return opp


def update_opportunity(
    db: Session,
    ctx: AuthenticatedContext,
    opp_id: uuid.UUID,
    payload: OpportunityUpdate,
) -> OpportunityResponse:
    opp = get_opportunity_or_404(db, ctx, opp_id)

    if opp.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Opportunity version conflict. Expected {payload.expected_version}, current is {opp.version}.",
                "current_version": opp.version,
            },
        )

    if payload.primary_contact_id:
        contact = db.execute(
            select(Contact).where(
                Contact.id == payload.primary_contact_id,
                Contact.account_id == opp.account_id,
                Contact.organization_id == ctx.organization.id,
            )
        ).scalar_one_or_none()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_CONTACT",
                    "message": "Primary contact must belong to the opportunity account",
                },
            )

    update_data = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    for field, val in update_data.items():
        setattr(opp, field, val)

    opp.version += 1
    opp.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="opportunity",
        entity_id=opp.id,
        event_type="opportunity_updated",
        summary=f"Opportunity '{opp.name}' updated by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(opp)

    resp = OpportunityResponse.model_validate(opp)
    resp.account_name = opp.account.name if opp.account else None
    return resp


def update_opportunity_stage(
    db: Session,
    ctx: AuthenticatedContext,
    opp_id: uuid.UUID,
    payload: OpportunityStageUpdate,
) -> OpportunityResponse:
    opp = get_opportunity_or_404(db, ctx, opp_id)

    if opp.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Opportunity version conflict. Expected {payload.expected_version}, current is {opp.version}.",
                "current_version": opp.version,
            },
        )

    # Won/Lost terminal check
    if opp.stage in ("won", "lost"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "TERMINAL_STAGE",
                "message": f"Opportunity is in terminal stage '{opp.stage}'. Use the reopen endpoint to reactivate it.",
            },
        )

    allowed = VALID_STAGE_TRANSITIONS.get(opp.stage, [])
    if payload.stage not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_STAGE_TRANSITION",
                "message": f"Cannot transition stage from '{opp.stage}' directly to '{payload.stage}'.",
            },
        )

    now = datetime.now(timezone.utc)

    # Loss rules
    if payload.stage == "lost":
        if not payload.loss_reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "LOSS_REASON_REQUIRED",
                    "message": "Loss reason is required when marking opportunity as lost.",
                },
            )
        if payload.loss_reason == "other" and not (
            payload.loss_detail and payload.loss_detail.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "LOSS_DETAIL_REQUIRED",
                    "message": "Explanation detail is required when loss reason is 'other'.",
                },
            )
        opp.loss_reason = payload.loss_reason
        opp.loss_detail = payload.loss_detail
        opp.lost_at = now

    # Win rules (PRD Section 6.3 & Phase 2 prompt):
    # Linked quote approval is required in full product, but in Phase 2 quotes are not yet enabled.
    # Manager/admin can mark won with a required override reason. Sales rep cannot.
    if payload.stage == "won":
        if ctx.membership.role not in (Role.SALES_MANAGER, Role.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "Only sales managers or administrators can mark an opportunity as won in Phase 2.",
                },
            )
        if not (payload.won_override_reason and payload.won_override_reason.strip()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "WON_OVERRIDE_REASON_REQUIRED",
                    "message": "Reason is required when marking won without an accepted quotation in Phase 2.",
                },
            )
        opp.won_at = now

    old_stage = opp.stage
    opp.stage = payload.stage
    opp.version += 1
    opp.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="opportunity",
        entity_id=opp.id,
        event_type="stage_change",
        summary=f"Opportunity '{opp.name}' stage changed from '{old_stage}' to '{opp.stage}' by {ctx.user.display_name}",
        metadata_json={
            "old_stage": old_stage,
            "new_stage": opp.stage,
            "loss_reason": opp.loss_reason,
            "won_override_reason": payload.won_override_reason,
        },
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(opp)

    resp = OpportunityResponse.model_validate(opp)
    resp.account_name = opp.account.name if opp.account else None
    return resp


def reopen_opportunity(
    db: Session,
    ctx: AuthenticatedContext,
    opp_id: uuid.UUID,
    payload: OpportunityReopenRequest,
) -> OpportunityResponse:
    opp = get_opportunity_or_404(db, ctx, opp_id)

    if opp.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Opportunity version conflict. Expected {payload.expected_version}, current is {opp.version}.",
                "current_version": opp.version,
            },
        )

    if opp.stage not in ("won", "lost"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "NOT_TERMINAL",
                "message": "Only won or lost opportunities can be reopened.",
            },
        )

    old_stage = opp.stage
    now = datetime.now(timezone.utc)
    opp.stage = "qualified"
    opp.won_at = None
    opp.lost_at = None
    opp.loss_reason = None
    opp.loss_detail = None
    opp.version += 1
    opp.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="opportunity",
        entity_id=opp.id,
        event_type="stage_change",
        summary=f"Opportunity '{opp.name}' reopened from '{old_stage}' to 'qualified' by {ctx.user.display_name}. Reason: {payload.reason}",
        metadata_json={
            "old_stage": old_stage,
            "new_stage": "qualified",
            "reopen_reason": payload.reason,
        },
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(opp)

    resp = OpportunityResponse.model_validate(opp)
    resp.account_name = opp.account.name if opp.account else None
    return resp


# ==================== Task Operations ====================


def format_task_response(task: Task) -> TaskResponse:
    from zoneinfo import ZoneInfo

    today_kolkata = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    resp = TaskResponse.model_validate(task)
    resp.is_overdue = (
        task.status == "open" and task.due_date is not None and task.due_date < today_kolkata
    )
    resp.account_name = task.account.name if task.account else None
    resp.opportunity_name = task.opportunity.name if task.opportunity else None
    resp.assignee_name = task.assignee.display_name if task.assignee else None
    return resp


def list_tasks(
    db: Session,
    ctx: AuthenticatedContext,
    assignee_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    account_id: Optional[uuid.UUID] = None,
    opportunity_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[TaskResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    # Current date in Asia/Kolkata
    from zoneinfo import ZoneInfo

    today_kolkata = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    query = select(Task).where(Task.organization_id == ctx.organization.id)

    # Enforce role scoping: sales_rep defaults to own tasks unless filtered
    if ctx.membership.role == Role.SALES_REP:
        # Sales rep can only see assigned tasks unless manager
        query = query.where(Task.assignee_user_id == ctx.user.id)
    elif assignee_id:
        query = query.where(Task.assignee_user_id == assignee_id)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority:
        query = query.where(Task.priority == priority)
    if account_id:
        query = query.where(Task.account_id == account_id)
    if opportunity_id:
        query = query.where(Task.opportunity_id == opportunity_id)
    if is_overdue is True:
        query = query.where(Task.status == "open", Task.due_date < today_kolkata)
    elif is_overdue is False:
        query = query.where(
            or_(Task.status != "open", Task.due_date >= today_kolkata, Task.due_date.is_(None))
        )
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(Task.title.ilike(search_pattern))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(
            selectinload(Task.account),
            selectinload(Task.opportunity),
            selectinload(Task.assignee),
        )
        .order_by(Task.status.asc(), Task.due_date.asc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    tasks = db.execute(query).scalars().all()

    items = [format_task_response(t) for t in tasks]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def create_task(
    db: Session,
    ctx: AuthenticatedContext,
    payload: TaskCreate,
) -> TaskResponse:
    # Validate account relationship
    if payload.account_id:
        get_account_or_404(db, ctx, payload.account_id)

    # Validate opportunity relationship
    if payload.opportunity_id:
        opp = get_opportunity_or_404(db, ctx, payload.opportunity_id)
        if payload.account_id and opp.account_id != payload.account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "RELATIONSHIP_MISMATCH",
                    "message": "Task opportunity does not belong to the selected account",
                },
            )

    # Validate assignee belongs to organization
    assignee_id = payload.assignee_user_id or ctx.user.id
    if (
        payload.assignee_user_id
        and ctx.membership.role == Role.SALES_REP
        and payload.assignee_user_id != ctx.user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Sales representatives cannot assign tasks to other team members",
            },
        )

    task = Task(
        organization_id=ctx.organization.id,
        title=payload.title,
        description=payload.description,
        account_id=payload.account_id,
        opportunity_id=payload.opportunity_id,
        assignee_user_id=assignee_id,
        due_date=payload.due_date,
        priority=payload.priority,
        status="open",
        created_by=ctx.user.id,
        version=1,
    )
    db.add(task)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="task",
        entity_id=task.id,
        event_type="task_created",
        summary=f"Task '{task.title}' created by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(task)

    return format_task_response(task)


def get_task_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    task_id: uuid.UUID,
) -> Task:
    stmt = (
        select(Task)
        .where(Task.id == task_id, Task.organization_id == ctx.organization.id)
        .options(
            selectinload(Task.account),
            selectinload(Task.opportunity),
            selectinload(Task.assignee),
        )
    )
    task = db.execute(stmt).scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": "Task not found or inaccessible"},
        )
    if ctx.membership.role == Role.SALES_REP and task.assignee_user_id != ctx.user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Access to another user's task is forbidden"},
        )
    return task


def update_task(
    db: Session,
    ctx: AuthenticatedContext,
    task_id: uuid.UUID,
    payload: TaskUpdate,
) -> TaskResponse:
    task = get_task_or_404(db, ctx, task_id)

    if task.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Task version conflict. Expected {payload.expected_version}, current is {task.version}.",
                "current_version": task.version,
            },
        )

    if (
        payload.assignee_user_id
        and ctx.membership.role == Role.SALES_REP
        and payload.assignee_user_id != ctx.user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Sales representatives cannot reassign tasks"},
        )

    update_data = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    for field, val in update_data.items():
        setattr(task, field, val)

    task.version += 1
    task.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="task",
        entity_id=task.id,
        event_type="task_updated",
        summary=f"Task '{task.title}' updated by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(task)

    return format_task_response(task)


def complete_task(
    db: Session,
    ctx: AuthenticatedContext,
    task_id: uuid.UUID,
    expected_version: int,
) -> TaskResponse:
    task = get_task_or_404(db, ctx, task_id)

    if task.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Task version conflict. Expected {expected_version}, current is {task.version}.",
                "current_version": task.version,
            },
        )

    now = datetime.now(timezone.utc)
    task.status = "completed"
    task.completed_at = now
    task.version += 1
    task.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="task",
        entity_id=task.id,
        event_type="task_completed",
        summary=f"Task '{task.title}' marked completed by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(task)

    return format_task_response(task)


def reopen_task(
    db: Session,
    ctx: AuthenticatedContext,
    task_id: uuid.UUID,
    expected_version: int,
) -> TaskResponse:
    task = get_task_or_404(db, ctx, task_id)

    if task.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Task version conflict. Expected {expected_version}, current is {task.version}.",
                "current_version": task.version,
            },
        )

    now = datetime.now(timezone.utc)
    task.status = "open"
    task.completed_at = None
    task.version += 1
    task.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="task",
        entity_id=task.id,
        event_type="task_reopened",
        summary=f"Task '{task.title}' reopened by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(task)

    return format_task_response(task)
