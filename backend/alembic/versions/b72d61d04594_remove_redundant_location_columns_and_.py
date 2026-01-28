"""remove_redundant_location_columns_and_triggers

Revision ID: b72d61d04594
Revises: e723a90cae60
Create Date: 2026-01-28 09:02:01.421848

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b72d61d04594'
down_revision: Union[str, Sequence[str], None] = 'e723a90cae60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Remove redundant location tracking:
    1. Drop triggers that auto-update last_location_id
    2. Remove last_location_id from packages (will query tracking_events instead)
    3. Remove delivery_location_id from tracking_events (only needed on packages)
    """
    # Drop triggers (SQLite-specific)
    op.execute("DROP TRIGGER IF EXISTS update_package_last_location_id_insert")
    op.execute("DROP TRIGGER IF EXISTS update_package_last_location_id_update")

    # Remove last_location_id from packages table
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.drop_column('last_location_id')

    # Remove delivery_location_id from tracking_events table
    with op.batch_alter_table('tracking_events', schema=None) as batch_op:
        batch_op.drop_column('delivery_location_id')


def downgrade() -> None:
    """
    Restore previous schema (if needed for rollback).
    Note: This will restore the columns and triggers, but data won't be recovered.
    """
    # Re-add last_location_id to packages
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_location_id', sa.String(), nullable=True))
        batch_op.create_foreign_key(
            'fk_packages_last_location_id',
            'locations',
            ['last_location_id'],
            ['location_string']
        )

    # Re-add delivery_location_id to tracking_events
    with op.batch_alter_table('tracking_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('delivery_location_id', sa.String(), nullable=True))
        batch_op.create_foreign_key(
            'fk_tracking_events_delivery_location_id',
            'delivery_locations',
            ['delivery_location_id'],
            ['id']
        )

    # Recreate triggers
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS update_package_last_location_id_insert
        AFTER INSERT ON tracking_events
        FOR EACH ROW
        BEGIN
            UPDATE packages
            SET last_location_id = (
                SELECT location_id
                FROM tracking_events
                WHERE package_id = NEW.package_id
                ORDER BY timestamp DESC
                LIMIT 1
            )
            WHERE id = NEW.package_id;
        END;
    """)

    op.execute("""
        CREATE TRIGGER IF NOT EXISTS update_package_last_location_id_update
        AFTER UPDATE ON tracking_events
        FOR EACH ROW
        WHEN OLD.location_id != NEW.location_id OR OLD.delivery_location_id != NEW.delivery_location_id
        BEGIN
            UPDATE packages
            SET last_location_id = (
                SELECT location_id
                FROM tracking_events
                WHERE package_id = NEW.package_id
                ORDER BY timestamp DESC
                LIMIT 1
            )
            WHERE id = NEW.package_id;
        END;
    """)
