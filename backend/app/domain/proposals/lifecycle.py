"""
Authoritative pure-Python Lifecycle and Transition Rules for ForgeFlow Proposals.
Enforces proposal state transitions and maker-checker separation of duties.
"""

import uuid
from typing import Dict, Set

VALID_PROPOSAL_STATES = {
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "cancelled",
    "stale",
    "committed",
}

# Explicit state transition map per PRD Section 6.9
ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    "draft": {"pending_review", "cancelled"},
    "pending_review": {"approved", "rejected", "cancelled", "stale"},
    "approved": {"committed", "stale"},
    "rejected": set(),  # terminal
    "cancelled": set(),  # terminal
    "stale": set(),  # terminal
    "committed": set(),  # terminal
}


def can_transition(current_status: str, target_status: str) -> bool:
    """Returns True if transition from current_status to target_status is permitted."""
    if current_status not in ALLOWED_TRANSITIONS:
        return False
    return target_status in ALLOWED_TRANSITIONS[current_status]


def assert_can_transition(current_status: str, target_status: str) -> None:
    """Raises ValueError if transition is forbidden."""
    if not can_transition(current_status, target_status):
        raise ValueError(
            f"Illegal proposal state transition from '{current_status}' to '{target_status}'."
        )


def assert_maker_checker(proposer_user_id: uuid.UUID, reviewer_user_id: uuid.UUID) -> None:
    """
    Enforces the fundamental maker-checker security invariant:
    A proposer may never approve or review their own proposal.
    """
    if proposer_user_id == reviewer_user_id:
        raise ValueError("Maker-checker violation: proposer cannot approve their own proposal.")
