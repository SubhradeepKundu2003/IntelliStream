from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class SuggestedWeight(BaseModel):
    subject_name: str
    weight_pct: float
    model_config = {"from_attributes": True}


class StreamSuggestionResponse(BaseModel):
    id: int
    batch_name: str
    generation_id: str
    name: str
    priority: int
    reasoning: str
    weights: List[SuggestedWeight]
    status: str
    generated_by_email: str
    created_at: datetime
    reviewed_by_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class GenerateSuggestionsRequest(BaseModel):
    business_context: Optional[str] = None
