# Guide Détaillé: Backend - Modèles & Database

## Table des matières
1. [Modèles SQLAlchemy](#models)
2. [Relations Entre Tables](#relations)
3. [Migrations Alembic](#migrations)
4. [Patterns & Bonnes Pratiques](#patterns)

---

## Modèles SQLAlchemy {#models}

### Qu'est-ce que c'est?

SQLAlchemy Models = classes Python qui correspondent aux tables SQL.

```python
# models/user.py
from sqlalchemy import Column, Integer, String
from app.core.database import Base

class User(Base):
    __tablename__ = "users"  # Nom table SQL
    
    id = Column(Integer, primary_key=True)  # SQL: INTEGER PRIMARY KEY
    email = Column(String, unique=True)     # SQL: VARCHAR UNIQUE
    username = Column(String)               # SQL: VARCHAR
```

**Ce model crée la table SQL:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR UNIQUE,
    username VARCHAR
);
```

### Types de Colonnes

```python
class User(Base):
    __tablename__ = "users"
    
    # Entiers
    id = Column(Integer, primary_key=True)
    age = Column(Integer, default=0)
    
    # Strings (texte)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String(255))  # Limite à 255 chars
    
    # DateTime
    from datetime import datetime
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Boolean
    is_admin = Column(Boolean, default=False)
    
    # JSON (PostgreSQL)
    metadata = Column(JSON)  # Stocke dicts/listes
    
    # Decimal (money, scores)
    from decimal import Decimal
    balance = Column(Numeric(10, 2))  # 10 digits, 2 decimal places
```

### Constraints & Indexes

```python
class User(Base):
    __tablename__ = "users"
    
    # PRIMARY KEY (identity)
    id = Column(Integer, primary_key=True)
    
    # UNIQUE (no duplicates)
    email = Column(String, unique=True)
    username = Column(String, unique=True)
    
    # NOT NULL (required)
    password_hash = Column(String, nullable=False)
    
    # DEFAULT (default value)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # INDEX (faster queries)
    email_index = Index("idx_email", "email")
    
    # FOREIGN KEY
    profile_id = Column(Integer, ForeignKey("profiles.id"))
    
    # CHECK (constraint)
    age = Column(Integer, CheckConstraint("age >= 0"))
```

### Relationships (ORM Magic)

```python
# models/user.py
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String)
    
    # Relationship: One User has One Profile
    profile = relationship(
        "Profile",
        back_populates="user",
        uselist=False,  # uselist=False → une profile (pas liste)
        cascade="all, delete-orphan"  # Si user supprimé → profile supprimé aussi
    )
    
    # Relationship: One User has Many GameResults
    game_results = relationship(
        "GameResult",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    # Relationship: Many-to-Many (via association table)
    friends = relationship(
        "User",
        secondary="friendships",  # Pointe vers table d'association
        primaryjoin="User.id == Friendship.user_id_a",
        secondaryjoin="User.id == Friendship.user_id_b"
    )

# models/profile.py
class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    bio = Column(String)
    
    # Relationship back-ref
    user = relationship(
        "User",
        back_populates="profile"
    )

# models/game_result.py
class GameResult(Base):
    __tablename__ = "game_results"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    score = Column(Integer)
    
    # Relationship
    user = relationship(
        "User",
        back_populates="game_results"
    )
```

**Utilisation:**

```python
# Query avec relationship
user = db.query(User).filter(User.id == 42).first()

# Accède profile automatiquement (lazy loaded)
print(user.profile.bio)

# Accède tous les game results
for result in user.game_results:
    print(result.score)

# Crée nouveau result
new_result = GameResult(score=1500)
user.game_results.append(new_result)  # Relationship ajoute automatiquement user_id
db.commit()
```

---

## Relations Entre Tables {#relations}

### 1. One-to-One

**User ↔ Profile**

```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    #                                                      ↑ UNIQUE
    #                                            Ensures 1-to-1

user = db.query(User).first()
profile = user.profile  # Une seule
```

**SQL:**
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id)
);

-- User 42 can only have 1 profile
SELECT * FROM profiles WHERE user_id = 42;
-- Returns max 1 row
```

### 2. One-to-Many

**User has Many GameResults**

```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    game_results = relationship("GameResult", back_populates="user")

class GameResult(Base):
    __tablename__ = "game_results"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="game_results")

user = db.query(User).first()
results = user.game_results  # Peut avoir N results
for result in results:
    print(result.score)
```

**SQL:**
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE game_results (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id)
);

-- User 42 peut avoir beaucoup de results
SELECT * FROM game_results WHERE user_id = 42;
-- Returns 0, 1, 2, ... N rows
```

### 3. Many-to-Many (Association Table)

**Users ↔ Friends**

```python
# Table d'association (pas besoin de model)
friendship_table = Table(
    'friendships',
    Base.metadata,
    Column('user_id_a', Integer, ForeignKey('users.id'), primary_key=True),
    Column('user_id_b', Integer, ForeignKey('users.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    
    friends = relationship(
        "User",
        secondary=friendship_table,
        primaryjoin=id == friendship_table.c.user_id_a,
        secondaryjoin=id == friendship_table.c.user_id_b,
        viewonly=True  # Simplifié: lecture seulement
    )

# Utilisation
user = db.query(User).first()
for friend in user.friends:
    print(friend.username)
```

**SQL:**
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE friendships (
    user_id_a INTEGER REFERENCES users(id),
    user_id_b INTEGER REFERENCES users(id),
    PRIMARY KEY (user_id_a, user_id_b)
);

-- User 42 et 99 sont amis
INSERT INTO friendships VALUES (42, 99);

-- Trouver amis de 42
SELECT * FROM friendships WHERE user_id_a = 42 OR user_id_b = 42;
```

---

## Migrations Alembic {#migrations}

### Qu'est-ce que c'est?

Alembic = outil pour gérer changements schema DB (versionné, traçable).

### Workflow

#### 1. Créer Migration (Auto-détecte changements)

```bash
# After modifying models
alembic revision --autogenerate -m "Add avatar to profiles"

# Creates file: alembic/versions/abc123_add_avatar_to_profiles.py
```

**Fichier généré:**

```python
# alembic/versions/abc123_add_avatar_to_profiles.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Code pour passer de schema old → new
    op.add_column(
        'profiles',
        sa.Column('avatar_url', sa.String(), nullable=True)
    )

def downgrade():
    # Code pour revenir en arrière
    op.drop_column('profiles', 'avatar_url')
```

#### 2. Appliquer Migration

```bash
# Applique toutes les migrations non encore appliquées
alembic upgrade head

# Applique juste 1
alembic upgrade abc123

# Revient en arrière
alembic downgrade -1  # -1 migration

# Check status
alembic current
alembic history
```

#### 3. Manual Migration (Changements complexes)

```bash
# Créer migration vide
alembic revision -m "Complex operation"
# → alembic/versions/xyz789_complex_operation.py
```

**Éditer le fichier manuellement:**

```python
# alembic/versions/xyz789_complex_operation.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. Ajoute nouvelle colonne
    op.add_column('users', sa.Column('new_email', sa.String(), nullable=True))
    
    # 2. Copie données
    op.execute('UPDATE users SET new_email = email')
    
    # 3. Supprime ancienne colonne
    op.drop_column('users', 'email')
    
    # 4. Renomme
    op.alter_column('users', 'new_email', new_column_name='email')

def downgrade():
    # Reverse
    op.alter_column('users', 'email', new_column_name='new_email')
    op.add_column('users', sa.Column('email', sa.String()))
    op.execute('UPDATE users SET email = new_email')
    op.drop_column('users', 'new_email')
```

### Alembic Config (alembic.ini)

```ini
# alembic.ini
[sqlalchemy]
sqlalchemy.url = postgresql://user:pass@localhost/mydb

[loggers]
keys = root,sqlalchemy,alembic

# ...
```

### Sequence Typique

```
1. Create/modify model
   ├── backend/python/app/models/user.py
   └── Add Field: avatar_url = Column(String)

2. Generate migration
   └── alembic revision --autogenerate -m "Add avatar"

3. Review migration
   ├── alembic/versions/abc123_add_avatar.py
   └── Vérifie up() et down()

4. Test locally
   ├── alembic upgrade head
   ├── Vérifie schema
   └── Reviens arrière: alembic downgrade -1

5. Commit
   ├── git add alembic/versions/abc123_add_avatar.py
   ├── git add app/models/user.py
   └── git commit -m "feat: add avatar to profiles"

6. Deploy
   ├── git pull (prod)
   ├── alembic upgrade head (prod)
   └── Server restart
```

---

## Patterns & Bonnes Pratiques {#patterns}

### 1. Timestamps

Toujours ajouter created_at et updated_at:

```python
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String)
    
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

# Automatically set:
user = User(email="user@example.com")
db.add(user)
db.commit()

print(user.created_at)  # 2024-03-15 10:30:00
print(user.updated_at)  # 2024-03-15 10:30:00

# Automatiquement mis à jour
user.email = "newemail@example.com"
db.commit()

print(user.updated_at)  # 2024-03-15 10:31:00
```

### 2. Soft Deletes

Au lieu de DELETE, marquer comme supprimé:

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String)
    
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)

# "Supprimer"
user = db.query(User).first()
user.is_deleted = True
user.deleted_at = datetime.utcnow()
db.commit()

# Query seulement actifs
active_users = db.query(User).filter(User.is_deleted == False).all()

# Peut récupérer plus tard si nécessaire
deleted_user = db.query(User).filter(User.id == 42, User.is_deleted == True).first()
if deleted_user:
    deleted_user.is_deleted = False
    deleted_user.deleted_at = None
    db.commit()  # "Undelete"
```

### 3. Enums (Types fixes)

```python
from enum import Enum
from sqlalchemy import Enum as SQLEnum

class Difficulty(str, Enum):
    EASY = "facile"
    MEDIUM = "moyen"
    HARD = "difficile"

class GameResult(Base):
    __tablename__ = "game_results"
    
    id = Column(Integer, primary_key=True)
    difficulty = Column(SQLEnum(Difficulty), nullable=False)
    result_status = Column(
        SQLEnum(ResultStatus),
        default=ResultStatus.PENDING
    )

# Utilisation
result = GameResult(difficulty=Difficulty.MEDIUM)
db.add(result)
db.commit()

print(result.difficulty)  # Difficulty.MEDIUM
print(result.difficulty.value)  # "moyen"
```

### 4. Contraintes (Constraints)

```python
from sqlalchemy import CheckConstraint, UniqueConstraint

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String)
    age = Column(Integer)
    
    # CHECK: âge valide
    __table_args__ = (
        CheckConstraint('age >= 0 AND age <= 150', name='valid_age'),
        UniqueConstraint('email', name='unique_email'),
    )

# La DB rejette:
user = User(email="user@example.com", age=200)
db.add(user)
db.commit()  # ✗ CheckConstraint violation

# DB accepte:
user = User(email="user@example.com", age=25)
db.add(user)
db.commit()  # ✓ OK
```

### 5. Indexes (Performance)

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    
    # Single column index
    email = Column(String, index=True)
    
    # Composite index
    username = Column(String)
    is_active = Column(Boolean)
    
    __table_args__ = (
        Index('idx_active_users', 'username', 'is_active'),
    )

# SQL générée:
# CREATE INDEX idx_active_users ON users(username, is_active);

# Requête est rapide (utilise index):
active_users = db.query(User).filter(
    User.username == "user1",
    User.is_active == True
).all()
```

### 6. JSON Storage

```python
from sqlalchemy import JSON

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String)
    
    # Stores dict/list as JSON in PostgreSQL
    settings = Column(JSON, default=dict)
    game_stats = Column(JSON, default=dict)

# Utilisation
user = User(email="user@example.com")
user.settings = {
    "theme": "dark",
    "notifications": True,
    "language": "en"
}
user.game_stats = {
    "wins": 10,
    "losses": 5,
    "avg_score": 1250.5
}
db.add(user)
db.commit()

# Query
user = db.query(User).first()
print(user.settings["theme"])  # "dark"
print(user.game_stats["wins"])  # 10
```

### 7. Cascades

```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    
    # cascade="all, delete-orphan"
    # Si User supprimé → tous ses GameResults supprimés aussi
    game_results = relationship(
        "GameResult",
        cascade="all, delete-orphan"
    )

# Supprimer user
user = db.query(User).first()
db.delete(user)
db.commit()

# Tous les game_results de cet user sont AUSSI supprimés
# Sans cascade, foreign key constraint erreur
```

### 8. Query Optimization

```python
# ❌ N+1 Problem
users = db.query(User).all()  # 1 query
for user in users:
    print(user.game_results)  # N queries!
# Total: 1 + N queries

# ✅ Joinedload (1 query avec JOIN)
from sqlalchemy.orm import joinedload

users = db.query(User).options(
    joinedload(User.game_results)
).all()
# game_results déjà chargés

# ✅ Selectinload (2 queries, optimisé)
from sqlalchemy.orm import selectinload

users = db.query(User).options(
    selectinload(User.game_results)
).all()
# 1 query pour users + 1 query pour tous game_results
# Utilise IN clause pour éviter N queries
```

### Exemple Complet: Migration

**Situation:** Ajouter système de ratings aux GameResults.

**Step 1: Modifier Model**

```python
# models/game_result.py
class GameResult(Base):
    __tablename__ = "game_results"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    score = Column(Integer)
    
    # NEW
    rating = Column(Integer, nullable=True)  # 1-5 stars
    rating_date = Column(DateTime, nullable=True)
```

**Step 2: Générer Migration**

```bash
alembic revision --autogenerate -m "Add rating to game results"
```

**Step 3: Check Generated File**

```python
# alembic/versions/abc123_add_rating_to_game_results.py
def upgrade():
    op.add_column(
        'game_results',
        sa.Column('rating', sa.Integer(), nullable=True)
    )
    op.add_column(
        'game_results',
        sa.Column('rating_date', sa.DateTime(), nullable=True)
    )

def downgrade():
    op.drop_column('game_results', 'rating_date')
    op.drop_column('game_results', 'rating')
```

**Step 4: Appliquer**

```bash
alembic upgrade head
```

**Voilà!** Tables mises à jour, code synchronisé.

