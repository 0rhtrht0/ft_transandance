"""merge_online_status_heads

Revision ID: 09800560de4c
Revises: 6193612a8353, 20260307_add_is_online_profiles
Create Date: 2026-03-07 17:01:49.356976

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09800560de4c'
down_revision: Union[str, Sequence[str], None] = ('6193612a8353', '20260307_add_is_online_profiles')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
