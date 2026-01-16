# Multi-stage Dockerfile for TrackIt
# Stage 1: Build frontend with Node.js and pnpm
# Stage 2: Python backend + Nginx serving both

# ===========================
# Stage 1: Build Frontend
# ===========================
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# Install pnpm
RUN npm install -g pnpm@latest

# Copy package files
COPY frontend/package.json frontend/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy frontend source code
COPY frontend/ ./

# Copy production environment file
COPY frontend/.env.production .env

# Build the frontend
RUN pnpm run build

# ===========================
# Stage 2: Backend + Nginx
# ===========================
FROM python:3.12-slim

# Install nginx and other system dependencies
RUN apt-get update && \
    apt-get install -y nginx curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/sites-available/default

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose port (nginx listens on 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start both nginx and FastAPI
CMD ["/start.sh"]
