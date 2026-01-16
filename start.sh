#!/bin/bash

# Start nginx in the background
nginx

# Start FastAPI backend in the foreground
uvicorn app.main:app --host 127.0.0.1 --port 8006
