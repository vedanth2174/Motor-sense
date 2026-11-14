"""Initial v2 schema for MotorSense

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-11-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # machines
    op.create_table(
        'machines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('rated_voltage', sa.Float(), nullable=False),
        sa.Column('rated_current', sa.Float(), nullable=False),
        sa.Column('rated_temp_max', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('location', sa.String(length=100), nullable=True),
        sa.Column('learning_status', sa.String(length=50), nullable=False, server_default='COLLECTING_BASELINE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('machine_id')
    )
    op.create_index(op.f('ix_machines_id'), 'machines', ['id'], unique=False)
    op.create_index(op.f('ix_machines_machine_id'), 'machines', ['machine_id'], unique=True)

    # devices
    op.create_table(
        'devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('api_key_hash', sa.String(length=64), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_devices_api_key_hash'), 'devices', ['api_key_hash'], unique=False)

    # sensor_readings
    op.create_table(
        'sensor_readings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('humidity', sa.Float(), nullable=True),
        sa.Column('current', sa.Float(), nullable=True),
        sa.Column('voltage', sa.Float(), nullable=True),
        sa.Column('vibration', sa.Float(), nullable=True),
        sa.Column('condition', sa.String(length=50), nullable=False, server_default='UNKNOWN'),
        sa.Column('anomaly_score', sa.Float(), nullable=True),
        sa.Column('is_valid', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sensor_readings_machine_id'), 'sensor_readings', ['machine_id'], unique=False)
    op.create_index(op.f('ix_sensor_readings_recorded_at'), 'sensor_readings', ['recorded_at'], unique=False)
    op.create_index('ix_sensor_readings_machine_recorded', 'sensor_readings', ['machine_id', 'recorded_at'], unique=False)

    # machine_baselines
    op.create_table(
        'machine_baselines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='COLLECTING_BASELINE'),
        sa.Column('sample_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('model_version', sa.String(length=50), nullable=True),
        sa.Column('model_path', sa.String(length=255), nullable=True),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.Column('trained_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('machine_id')
    )

    # alerts
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('message', sa.String(length=255), nullable=False),
        sa.Column('reading_id', sa.Integer(), nullable=True),
        sa.Column('acknowledged_by', sa.String(length=100), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reading_id'], ['sensor_readings.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # ai_analyses
    op.create_table(
        'ai_analyses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('input_summary', sa.JSON(), nullable=False),
        sa.Column('output', sa.JSON(), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # maintenance_records
    op.create_table(
        'maintenance_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('machine_id', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='OPEN'),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.machine_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('maintenance_records')
    op.drop_table('ai_analyses')
    op.drop_table('alerts')
    op.drop_table('machine_baselines')
    op.drop_table('sensor_readings')
    op.drop_table('devices')
    op.drop_table('machines')
