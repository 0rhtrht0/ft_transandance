"""
Add avatar column to profiles table

Revision ID: 20260306_add_avatar_to_profiles
Revises: 817314150bae
Create Date: 2026-03-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260306_add_avatar_to_profiles'
down_revision: Union[str, Sequence[str], None] = '817314150bae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.add_column('profiles', sa.Column('avatar', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('profiles', 'avatar')