-- init SQL executed only when the database is first created
-- create useful extensions (no-op if already present)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
