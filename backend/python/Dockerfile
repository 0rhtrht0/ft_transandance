FROM python:3.11-slim

WORKDIR /usr/src/app


RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc build-essential libffi-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*


COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt


COPY . .

EXPOSE 8000

# Wait for postgres then run migrations and start server
CMD ["sh", "-c", "sleep 10 && python -m app.core.startup_migrations && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
