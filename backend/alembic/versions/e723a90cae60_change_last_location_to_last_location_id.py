"""change_last_location_to_last_location_id

Revision ID: e723a90cae60
Revises: 99572e6427a6
Create Date: 2026-01-26 06:38:46.947692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e723a90cae60'
down_revision: Union[str, Sequence[str], None] = '99572e6427a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Step 1: Add new last_location_id column (nullable initially)
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_location_id', sa.String(), nullable=True))
        batch_op.create_foreign_key(
            'fk_packages_last_location',
            'locations',
            ['last_location_id'],
            ['location_string']
        )

    # Step 2: Migrate existing data from last_location to last_location_id
    # Only migrate if the location exists in the locations table
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE packages
        SET last_location_id = last_location
        WHERE last_location IS NOT NULL
        AND last_location IN (SELECT location_string FROM locations)
    """))

    # Step 3: Drop the old last_location column
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.drop_column('last_location')

    # Step 4: Create triggers to automatically update last_location_id when tracking events change
    # This trigger finds the most recent tracking event and updates the package's last_location_id

    # Trigger for INSERT
    conn.execute(sa.text("""
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
    """))

    # Trigger for UPDATE (when delivery_location_id or location_id changes)
    conn.execute(sa.text("""
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
    """))


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the triggers first
    conn = op.get_bind()
    conn.execute(sa.text("DROP TRIGGER IF EXISTS update_package_last_location_id_insert"))
    conn.execute(sa.text("DROP TRIGGER IF EXISTS update_package_last_location_id_update"))

    # Add back the last_location column
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_location', sa.String(), nullable=True))

    # Migrate data back from last_location_id to last_location
    conn.execute(sa.text("""
        UPDATE packages
        SET last_location = last_location_id
        WHERE last_location_id IS NOT NULL
    """))

    # Drop the last_location_id column and its foreign key
    with op.batch_alter_table('packages', schema=None) as batch_op:
        batch_op.drop_constraint('fk_packages_last_location', type_='foreignkey')
        batch_op.drop_column('last_location_id')
