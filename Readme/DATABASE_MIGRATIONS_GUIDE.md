# Guide Complet: Database & Migrations avec Alembic

## Table des matières
1. [Alembic Setup](#setup)
2. [Creating Migrations](#creating)
3. [Running Migrations](#running)
4. [Advanced Patterns](#patterns)
5. [Troubleshooting](#troubleshooting)

---

## Alembic Setup {#setup}

### Installation & Init

```bash
# Install Alembic
pip install alembic

# Initialize Alembic in project
alembic init alembic
```

### alembic.ini (Configuration)

```ini
# alembic.ini

[alembic]
# Path to migration scripts
script_location = alembic

# Naming convention for migration files
file_template = %%(rev)s_%%(slug)s

# Default revision
sqlalchemy.url = sqlite:///./test.db

[loggers]
keys = root,sqlalchemy

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

### env.py (Alembic Environment)

```python
# alembic/env.py

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
from app.core.database import Base
from app.models import *  # Import all models

# Get database URL from environment
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost/transcendence'
)

config = context.config
config.set_main_option('sqlalchemy.url', DATABASE_URL)

# Setup logging
fileConfig(config.config_file_name)

# Set target_metadata for autogenerate
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations 'offline' (without live DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations 'online' (with live DB connection)."""
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = DATABASE_URL
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

## Creating Migrations {#creating}

### Auto-Generate Migration

```bash
# Alembic compares current model definitions to database schema
# and generates migration automatically

alembic revision --autogenerate -m "Add user table"

# Output:
# Generating /path/to/alembic/versions/abc123_add_user_table.py
```

### Generated Migration Example

```python
# alembic/versions/20250317_add_user_table.py

"""Add user table

Revision ID: 20250317abc123
Revises: 
Create Date: 2025-03-17 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# Unique identifier for this migration
revision = '20250317abc123'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Apply migration (forward)"""
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('username', sa.String(255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    
    # Create index for faster lookups
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

def downgrade() -> None:
    """Reverse migration (backward)"""
    
    # Drop index
    op.drop_index(op.f('ix_users_email'), table_name='users')
    
    # Drop table
    op.drop_table('users')
```

### Manual Migration (Complex Changes)

```python
# alembic/versions/20250317_add_friendship_normalization.py

"""Add friendship normalization

This migration normalizes friendships to always store
min(user_id) as user_id_1 and max(user_id) as user_id_2
"""
from alembic import op
import sqlalchemy as sa

revision = '20250317def456'
down_revision = '20250317abc123'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create new normalized table
    op.create_table(
        'friendships_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id_1', sa.Integer(), nullable=False),
        sa.Column('user_id_2', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id_1'], ['users.id']),
        sa.ForeignKeyConstraint(['user_id_2'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id_1', 'user_id_2'),
        sa.CheckConstraint('user_id_1 < user_id_2')
    )
    
    # Copy data with normalization
    op.execute('''
        INSERT INTO friendships_new (id, user_id_1, user_id_2, created_at)
        SELECT 
            id,
            CASE WHEN from_user_id < to_user_id 
                 THEN from_user_id 
                 ELSE to_user_id 
            END,
            CASE WHEN from_user_id < to_user_id 
                 THEN to_user_id 
                 ELSE from_user_id 
            END,
            created_at
        FROM friendships
        WHERE status = 'accepted'
    ''')
    
    # Drop old table
    op.drop_table('friendships')
    
    # Rename new table
    op.rename_table('friendships_new', 'friendships')

def downgrade() -> None:
    # Recreate old table schema
    op.create_table(
        'friendships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_user_id', sa.Integer(), nullable=False),
        sa.Column('to_user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Copy data back (denormalized)
    op.execute('''
        INSERT INTO friendships (id, from_user_id, to_user_id, status, created_at)
        SELECT id, user_id_1, user_id_2, 'accepted', created_at
        FROM friendships
    ''')
    
    # Drop normalized table
    op.drop_table('friendships')
```

### Data Migrations

```python
# alembic/versions/20250317_hash_existing_passwords.py

"""Hash existing plain-text passwords

This migration hashes all existing passwords that weren't hashed yet
"""
from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

revision = '20250317ghi789'
down_revision = '20250317def456'

def upgrade() -> None:
    # Get connection to run queries
    connection = op.get_bind()
    
    # Select users with plain-text passwords
    result = connection.execute(
        sa.text('SELECT id, hashed_password FROM users WHERE hashed_password NOT LIKE "$argon2%"')
    )
    
    # Hash and update
    for user_id, plain_pass in result:
        hashed = pwd_context.hash(plain_pass)
        connection.execute(
            sa.text('UPDATE users SET hashed_password = :hashed WHERE id = :id'),
            {'hashed': hashed, 'id': user_id}
        )

def downgrade() -> None:
    # Can't downgrade password hashing
    pass
```

---

## Running Migrations {#running}

### Basic Commands

```bash
# Show current revision
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic heads

# Upgrade to latest
alembic upgrade head

# Upgrade by 1 migration
alembic upgrade +1

# Upgrade to specific revision
alembic upgrade 20250317abc123

# Downgrade by 1 migration
alembic downgrade -1

# Downgrade to specific revision
alembic downgrade 20250317def456

# Show migration details (SQL)
alembic upgrade head --sql
```

### In Python Code

```python
# backend/python/app/main.py

from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from alembic import command
import os

def run_migrations():
    """Run pending migrations on startup"""
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option(
        "sqlalchemy.url",
        os.getenv('DATABASE_URL')
    )
    
    # Run upgrade
    command.upgrade(alembic_cfg, "head")

# Run on app startup
if __name__ == "__main__":
    run_migrations()
    
    # Then start app
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
```

### In Docker

```dockerfile
# backend/python/Dockerfile

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run migrations on container start
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

---

## Advanced Patterns {#patterns}

### Dependency Between Migrations

```python
# alembic/versions/20250317_jkl012.py

revision = '20250317jkl012'
down_revision = ['20250317abc123', '20250317def456']  # Depends on 2 migrations
# (Used for merge conflicts)

def upgrade() -> None:
    # Both parent migrations must be applied first
    pass

def downgrade() -> None:
    pass
```

### Conditional Migrations (Different DB Engines)

```python
# alembic/versions/20250317_add_generated_column.py

from alembic import op
from sqlalchemy.dialects import postgresql, mysql

revision = '20250317mno345'
down_revision = '20250317jkl012'

def upgrade() -> None:
    # PostgreSQL specific
    op.execute('''
        ALTER TABLE users
        ADD COLUMN full_name GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED
    ''')

def downgrade() -> None:
    op.drop_column('users', 'full_name')
```

### Large Data Migrations with Batching

```python
# alembic/versions/20250317_batch_data_migration.py

from alembic import op
import sqlalchemy as sa

revision = '20250317pqr678'
down_revision = '20250317mno345'

def upgrade() -> None:
    """Migrate data in batches to avoid memory issues"""
    connection = op.get_bind()
    
    batch_size = 1000
    offset = 0
    
    while True:
        # Fetch batch
        result = connection.execute(
            sa.text('''
                SELECT id, email FROM users
                LIMIT :limit OFFSET :offset
            '''),
            {'limit': batch_size, 'offset': offset}
        )
        
        rows = result.fetchall()
        if not rows:
            break
        
        # Process batch
        for user_id, email in rows:
            # Do something
            connection.execute(
                sa.text('UPDATE users SET processed = TRUE WHERE id = :id'),
                {'id': user_id}
            )
        
        offset += batch_size
        print(f'Processed {offset} rows')

def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text('UPDATE users SET processed = FALSE'))
```

### Zero-Downtime Migrations

```python
# Pattern: Add column with default, gradually populate, then make required

# Step 1: Add nullable column
def upgrade_step1() -> None:
    op.add_column(
        'users',
        sa.Column('email_verified', sa.Boolean(), nullable=True)
    )

# Step 2: Backfill data (in separate migration)
def upgrade_step2() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text('UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL')
    )

# Step 3: Make NOT NULL (in separate migration after confirming no NULLs)
def upgrade_step3() -> None:
    op.alter_column('users', 'email_verified', nullable=False)
```

---

## Troubleshooting {#troubleshooting}

### Merge Conflicts

```bash
# When multiple branches modify database

# List conflicting heads
alembic heads -v

# Merge migrations
alembic merge -m "Merge migrations"

# Edit merged file to resolve conflicts
```

### Downgrade Issues

```bash
# Show what would happen (dry run)
alembic downgrade -1 --sql

# If downgrade fails, manually rollback
# Then fix migration files
```

### Stuck Migrations

```bash
# Mark migration as applied without running it
alembic stamp 20250317abc123

# Mark as not applied
# (Dangerous - only if migration partially ran)
alembic downgrade -1

# Force remove from history (last resort)
# DELETE FROM alembic_version WHERE version_num = '20250317abc123';
```

### Testing Migrations

```python
# tests/test_migrations.py

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic import command
from sqlalchemy import create_engine

@pytest.fixture
def migration_engine():
    """Create test database for migrations"""
    engine = create_engine('sqlite:///:memory:')
    yield engine

def test_migration_up_and_down(migration_engine):
    """Test migration can go up and down"""
    config = Config('alembic.ini')
    config.set_main_option('sqlalchemy.url', 'sqlite:///:memory:')
    
    # Upgrade to latest
    command.upgrade(config, 'head')
    
    # Verify schema
    inspector = inspect(migration_engine)
    tables = inspector.get_table_names()
    assert 'users' in tables
    
    # Downgrade by 1
    command.downgrade(config, '-1')
    
    # Verify rollback
    inspector = inspect(migration_engine)
    tables = inspector.get_table_names()
    # Verify table structure changed
```

### Migration Naming Convention

```python
# Good:
# 20250317_add_user_email_index
# 20250317_create_friendship_table
# 20250317_hash_passwords_migration

# Bad:
# v1
# update
# fix_database
```

