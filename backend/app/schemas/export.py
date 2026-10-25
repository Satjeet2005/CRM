import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class QuoteCustomerDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quote_id: uuid.UUID
    revision_id: uuid.UUID
    export_type: str
    sha256_hash: str
    recipient_email: Optional[str] = None
    watermarked: bool
    exported_by_user_id: uuid.UUID
    exported_by_name: Optional[str] = None
    created_at: datetime
