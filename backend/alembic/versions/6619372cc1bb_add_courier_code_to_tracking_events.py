"""add_courier_code_to_tracking_events

Revision ID: 6619372cc1bb
Revises: 75f0e5c978c2
Create Date: 2026-01-19 11:37:57.339543

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6619372cc1bb'
down_revision: Union[str, Sequence[str], None] = '75f0e5c978c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add courier_code column to tracking_events table
    op.add_column('tracking_events', sa.Column('courier_code', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove courier_code column from tracking_events table
    op.drop_column('tracking_events', 'courier_code')
