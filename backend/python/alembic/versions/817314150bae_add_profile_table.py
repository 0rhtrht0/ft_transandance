"""add profile table

Revision ID: 817314150bae
Revises: 50c87ddbfd98
Create Date: 2026-03-03 16:47:07.900006

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = '817314150bae'
down_revision: Union[str, Sequence[str], None] = '50c87ddbfd98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass



def downgrade() -> None:
    """Downgrade schema."""
    pass
