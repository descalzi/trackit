"""change_courier_to_string

Revision ID: 75f0e5c978c2
Revises: 83d3d141d909
Create Date: 2026-01-19 07:22:23.786616

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75f0e5c978c2'
down_revision: Union[str, Sequence[str], None] = '83d3d141d909'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change courier column from enum to string."""
    # For SQLite, we need to recreate the table
    # First, add a temporary column for the new string values
    op.add_column('packages', sa.Column('courier_temp', sa.String(), nullable=True))

    # Copy data from old column to new column
    # The enum values are already strings, so we can copy directly
    op.execute('UPDATE packages SET courier_temp = courier')

    # Drop the old enum column
    with op.batch_alter_table('packages') as batch_op:
        batch_op.drop_column('courier')

    # Rename the temp column to courier
    with op.batch_alter_table('packages') as batch_op:
        batch_op.alter_column('courier_temp', new_column_name='courier')


def downgrade() -> None:
    """Downgrade schema - not implemented as enum values were limited."""
    pass
