"""add_is_admin_column_to_users

Revision ID: 0ce37723ed05
Revises: 6619372cc1bb
Create Date: 2026-01-20 04:48:58.274237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ce37723ed05'
down_revision: Union[str, Sequence[str], None] = '6619372cc1bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add is_admin column to users table with default value False
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove is_admin column from users table
    op.drop_column('users', 'is_admin')
