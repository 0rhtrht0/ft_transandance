from app.core.database import engine
from sqlalchemy import text

with engine.connect() as con:
    rs = con.execute(text("SELECT id, email, password_reset_token_hash FROM users"))
    for row in rs:
        print(row)
