"""Add locations table and location_id to tracking_events

Revision ID: 77899457508b
Revises: 
Create Date: 2026-01-19 06:16:08.197127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77899457508b'
down_revision: Union[str, Sequence[str], None] = '000000000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Create locations table only if it doesn't exist
    # Check if table exists
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'"
    )).fetchone()

    if not result:
        # Create locations table
        op.create_table(
            'locations',
            sa.Column('location_string', sa.String(), nullable=False),
            sa.Column('normalized_location', sa.String(), nullable=False),
            sa.Column('latitude', sa.Float(), nullable=True),
            sa.Column('longitude', sa.Float(), nullable=True),
            sa.Column('display_name', sa.String(), nullable=True),
            sa.Column('country_code', sa.String(length=2), nullable=True),
            sa.Column('geocoded_at', sa.DateTime(), nullable=True),
            sa.Column('geocoding_failed', sa.Boolean(), nullable=True, default=False),
            sa.PrimaryKeyConstraint('location_string')
        )
        op.create_index(op.f('ix_locations_location_string'), 'locations', ['location_string'], unique=False)

    # Add location_id column to tracking_events (nullable)
    # Check if column exists first
    result = conn.execute(sa.text(
        "PRAGMA table_info(tracking_events)"
    )).fetchall()

    has_location_id = any(col[1] == 'location_id' for col in result)

    if not has_location_id:
        op.add_column('tracking_events', sa.Column('location_id', sa.String(), nullable=True))

    # Populate locations table with unique location strings from tracking_events
    # Only insert if there are locations to migrate
    conn.execute(sa.text("""
        INSERT OR IGNORE INTO locations (location_string, normalized_location, geocoding_failed)
        SELECT DISTINCT
            location,
            location,
            0
        FROM tracking_events
        WHERE location IS NOT NULL AND location != ''
    """))

    # Link tracking_events to locations via location_id
    conn.execute(sa.text("""
        UPDATE tracking_events
        SET location_id = location
        WHERE location IS NOT NULL AND location != '' AND location_id IS NULL
    """))

    # Create foreign key only if it doesn't exist
    # Note: SQLite doesn't support adding foreign keys to existing tables easily
    # The foreign key will be enforced by the ORM


def downgrade() -> None:
    """Downgrade schema."""
    # Drop location_id column from tracking_events
    # Note: SQLite doesn't support DROP COLUMN directly, would need table recreation
    # For simplicity, this is a placeholder - in production you'd recreate the table
    conn = op.get_bind()

    # Clear location_id values
    conn.execute(sa.text("UPDATE tracking_events SET location_id = NULL"))

    # Drop locations table
    conn.execute(sa.text("DROP TABLE IF EXISTS locations"))
