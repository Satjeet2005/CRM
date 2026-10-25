import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.crm import Activity


def record_activity(
    db: Session,
    organization_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    event_type: str,
    summary: str,
    metadata_json: Optional[dict[str, Any]] = None,
    actor_user_id: Optional[uuid.UUID] = None,
) -> Activity:
    """
    Record an append-only activity timeline entry within the current transaction.
    If the transaction rolls back, this activity entry is not committed.
    """
    activity = Activity(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        summary=summary,
        metadata_json=metadata_json or {},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(activity)
    return activity
