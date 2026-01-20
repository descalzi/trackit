"""add_delivery_location_id_to_tracking_events

Revision ID: 102ce44de1b1
Revises: 3a3c076a7c70
Create Date: 2026-01-20 05:39:26.399762

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '102ce44de1b1'
down_revision: Union[str, Sequence[str], None] = '3a3c076a7c70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add delivery_location_id column to tracking_events
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('tracking_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('delivery_location_id', sa.String(), nullable=True))
        batch_op.create_foreign_key(
            'fk_tracking_events_delivery_location_id',
            'delivery_locations',
            ['delivery_location_id'], ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove delivery_location_id column from tracking_events
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('tracking_events', schema=None) as batch_op:
        batch_op.drop_constraint('fk_tracking_events_delivery_location_id', type_='foreignkey')
        batch_op.drop_column('delivery_location_id')
