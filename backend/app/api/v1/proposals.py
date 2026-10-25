import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.proposals import (
    ApprovalDecisionRequest,
    ApprovalDecisionResponse,
    CommitProposalRequest,
    ProposalDetailResponse,
    ProposalDiffResponse,
    UpdateProposalDraftRequest,
)
from app.schemas.quote import QuoteRevisionResponse
from app.services import approval_service, proposal_service, quote_service

router = APIRouter(prefix="/proposals", tags=["Proposals"])


@router.get("/{proposal_id}", response_model=ProposalDetailResponse)
def get_proposal(
    proposal_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> ProposalDetailResponse:
    return proposal_service.get_proposal_detail(db=db, ctx=ctx, proposal_id=proposal_id)


@router.get("/{proposal_id}/diff", response_model=ProposalDiffResponse)
def get_proposal_diff(
    proposal_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> ProposalDiffResponse:
    return proposal_service.get_proposal_diff_response(db=db, ctx=ctx, proposal_id=proposal_id)


@router.patch("/{proposal_id}", response_model=ProposalDetailResponse)
def update_proposal(
    proposal_id: uuid.UUID,
    payload: UpdateProposalDraftRequest,
    ctx: AuthenticatedContext = Depends(require_permission("proposals:create")),
    db: Session = Depends(get_db),
) -> ProposalDetailResponse:
    proposal_service.update_proposal_draft(db=db, ctx=ctx, proposal_id=proposal_id, payload=payload)
    return proposal_service.get_proposal_detail(db=db, ctx=ctx, proposal_id=proposal_id)


@router.post("/{proposal_id}/submit", response_model=ProposalDetailResponse)
def submit_proposal(
    proposal_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("proposals:create")),
    db: Session = Depends(get_db),
) -> ProposalDetailResponse:
    proposal_service.submit_proposal(db=db, ctx=ctx, proposal_id=proposal_id)
    return proposal_service.get_proposal_detail(db=db, ctx=ctx, proposal_id=proposal_id)


@router.post("/{proposal_id}/cancel", response_model=ProposalDetailResponse)
def cancel_proposal(
    proposal_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("proposals:create")),
    db: Session = Depends(get_db),
) -> ProposalDetailResponse:
    proposal_service.cancel_proposal(db=db, ctx=ctx, proposal_id=proposal_id)
    return proposal_service.get_proposal_detail(db=db, ctx=ctx, proposal_id=proposal_id)


@router.post("/{proposal_id}/approve", response_model=ApprovalDecisionResponse)
def approve_proposal(
    proposal_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ctx: AuthenticatedContext = Depends(require_permission("proposals:approve")),
    db: Session = Depends(get_db),
) -> ApprovalDecisionResponse:
    if idempotency_key and not payload.idempotency_key:
        payload.idempotency_key = idempotency_key
    return approval_service.approve_proposal(
        db=db, ctx=ctx, proposal_id=proposal_id, request=payload
    )


@router.post("/{proposal_id}/reject", response_model=ApprovalDecisionResponse)
def reject_proposal(
    proposal_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ctx: AuthenticatedContext = Depends(require_permission("proposals:approve")),
    db: Session = Depends(get_db),
) -> ApprovalDecisionResponse:
    if idempotency_key and not payload.idempotency_key:
        payload.idempotency_key = idempotency_key
    return approval_service.reject_proposal(
        db=db, ctx=ctx, proposal_id=proposal_id, request=payload
    )


@router.post("/{proposal_id}/commit", response_model=QuoteRevisionResponse)
def commit_proposal(
    proposal_id: uuid.UUID,
    payload: Optional[CommitProposalRequest] = None,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> QuoteRevisionResponse:
    idem = (
        payload.idempotency_key if payload and payload.idempotency_key else None
    ) or idempotency_key
    rev = proposal_service.commit_proposal(
        db=db, ctx=ctx, proposal_id=proposal_id, idempotency_key=idem
    )
    return quote_service.get_quote_revision_detail(
        db=db, ctx=ctx, quote_id=rev.quote_id, revision_id=rev.id
    )
