"""Add alias column to locations

Revision ID: 83d3d141d909
Revises: 77899457508b
Create Date: 2026-01-19 06:51:58.657332

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83d3d141d909'
down_revision: Union[str, Sequence[str], None] = '77899457508b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add alias column to locations table
    op.add_column('locations', sa.Column('alias', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove alias column from locations table
    op.drop_column('locations', 'alias')
