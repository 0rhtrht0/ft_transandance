import smtplib
from dotenv import load_dotenv
import os

load_dotenv()

host = os.getenv("SMTP_HOST")
port = int(os.getenv("SMTP_PORT", 587))
user = os.getenv("SMTP_USERNAME")
password = os.getenv("SMTP_PASSWORD")

print(f"Connecting to {host}:{port} with user {user}...")

try:
    server = smtplib.SMTP(host, port, timeout=10)
    server.starttls()
    server.login(user, password)
    print("SUCCESS: Logged in successfully!")
    server.quit()
except Exception as e:
    print(f"ERROR: {e}")
