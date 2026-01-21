#!/bin/bash

# Run Alembic migrations to ensure database is up to date
echo "Running database migrations..."
alembic upgrade head

# Start nginx in the background
nginx

# Start FastAPI backend in the foreground
uvicorn app.main:app --host 127.0.0.1 --port 8006
