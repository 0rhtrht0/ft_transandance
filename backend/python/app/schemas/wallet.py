from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WalletTransactionResponse(BaseModel):
    id: int
    evaluation_points_delta: int = Field(..., examples=[1])
    balance_before: int = Field(..., examples=[4])
    balance_after: int = Field(..., examples=[5])
    transaction_type: str = Field(..., examples=["solo_escape"])
    description: str | None = Field(default=None, examples=["Solo escape"])
    context: dict = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WalletResponse(BaseModel):
    user_id: int
    total_evaluation_points: int = Field(..., examples=[5])
    unlocked_achievements: list[str] = Field(default_factory=list)
    transactions_count: int = Field(..., examples=[8])
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
