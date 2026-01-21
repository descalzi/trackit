"""initial_schema

Revision ID: 000000000000
Revises:
Create Date: 2026-01-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '000000000000'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial database schema with base tables."""
    conn = op.get_bind()

    # Create users table
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    )).fetchone()

    if not result:
        op.create_table(
            'users',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('picture', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create packages table
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='packages'"
    )).fetchone()

    if not result:
        op.create_table(
            'packages',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('tracking_number', sa.String(), nullable=False),
            sa.Column('courier', sa.String(), nullable=True),
            sa.Column('note', sa.String(), nullable=True),
            sa.Column('ship24_tracker_id', sa.String(), nullable=True),
            sa.Column('last_status', sa.String(), nullable=True),
            sa.Column('last_location', sa.String(), nullable=True),
            sa.Column('last_updated', sa.DateTime(), nullable=True),
            sa.Column('delivered_at', sa.DateTime(), nullable=True),
            sa.Column('origin_country', sa.String(), nullable=True),
            sa.Column('destination_country', sa.String(), nullable=True),
            sa.Column('estimated_delivery', sa.DateTime(), nullable=True),
            sa.Column('detected_courier', sa.String(), nullable=True),
            sa.Column('archived', sa.Boolean(), nullable=True, default=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_packages_id'), 'packages', ['id'], unique=False)
        op.create_index(op.f('ix_packages_user_id'), 'packages', ['user_id'], unique=False)
        op.create_index(op.f('ix_packages_tracking_number'), 'packages', ['tracking_number'], unique=False)

    # Create tracking_events table
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tracking_events'"
    )).fetchone()

    if not result:
        op.create_table(
            'tracking_events',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('package_id', sa.String(), nullable=False),
            sa.Column('status', sa.String(), nullable=False),
            sa.Column('location', sa.String(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('courier_event_code', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['package_id'], ['packages.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_tracking_events_id'), 'tracking_events', ['id'], unique=False)
        op.create_index(op.f('ix_tracking_events_package_id'), 'tracking_events', ['package_id'], unique=False)
        op.create_index(op.f('ix_tracking_events_timestamp'), 'tracking_events', ['timestamp'], unique=False)


def downgrade() -> None:
    """Drop all base tables."""
    op.drop_index(op.f('ix_tracking_events_timestamp'), table_name='tracking_events')
    op.drop_index(op.f('ix_tracking_events_package_id'), table_name='tracking_events')
    op.drop_index(op.f('ix_tracking_events_id'), table_name='tracking_events')
    op.drop_table('tracking_events')

    op.drop_index(op.f('ix_packages_tracking_number'), table_name='packages')
    op.drop_index(op.f('ix_packages_user_id'), table_name='packages')
    op.drop_index(op.f('ix_packages_id'), table_name='packages')
    op.drop_table('packages')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
