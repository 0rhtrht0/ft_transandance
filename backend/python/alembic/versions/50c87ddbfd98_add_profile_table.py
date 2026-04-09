"""add profile table

Revision ID: 50c87ddbfd98
Revises: a027dd7daec1
Create Date: 2026-03-03 16:46:19.438858

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '50c87ddbfd98'
down_revision: Union[str, Sequence[str], None] = 'a027dd7daec1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('bio', sa.String(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_profiles_id'), 'profiles', ['id'], unique=False)
    op.add_column('users', sa.Column('hashed_password', sa.String(), nullable=False))
    op.alter_column('users', 'username',
               existing_type=sa.VARCHAR(),
               nullable=False)
    op.alter_column('users', 'email',
               existing_type=sa.VARCHAR(),
               nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('users', 'email',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.alter_column('users', 'username',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.drop_column('users', 'hashed_password')
    op.drop_index(op.f('ix_profiles_id'), table_name='profiles')
    op.drop_table('profiles')
