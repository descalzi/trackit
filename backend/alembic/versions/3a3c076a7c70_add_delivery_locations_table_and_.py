"""add_delivery_locations_table_and_reference

Revision ID: 3a3c076a7c70
Revises: 0ce37723ed05
Create Date: 2026-01-20 05:04:58.675398

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a3c076a7c70'
down_revision: Union[str, Sequence[str], None] = '0ce37723ed05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create delivery_locations table
    op.create_table(
        'delivery_locations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('country_code', sa.String(2), nullable=True),
        sa.Column('geocoded_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )
    op.create_index(op.f('ix_delivery_locations_id'), 'delivery_locations', ['id'], unique=False)
    op.create_index(op.f('ix_delivery_locations_user_id'), 'delivery_locations', ['user_id'], unique=False)

    # Add delivery_location_id column to packages table
    op.add_column('packages', sa.Column('delivery_location_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_packages_delivery_location_id', 'packages', 'delivery_locations', ['delivery_location_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove delivery_location_id from packages
    op.drop_constraint('fk_packages_delivery_location_id', 'packages', type_='foreignkey')
    op.drop_column('packages', 'delivery_location_id')

    # Drop delivery_locations table
    op.drop_index(op.f('ix_delivery_locations_user_id'), table_name='delivery_locations')
    op.drop_index(op.f('ix_delivery_locations_id'), table_name='delivery_locations')
    op.drop_table('delivery_locations')
