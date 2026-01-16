from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, packages, tracking
from app.database import init_db
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="TrackIt Backend API",
    description="Package tracking application API with Google OAuth authentication and Ship24 integration",
    version="1.0.0"
)

# CORS configuration
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:8084"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(packages.router, prefix="/api/packages", tags=["Packages"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Tracking"])


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()


@app.get("/")
async def root():
    """API welcome message"""
    return {
        "message": "Welcome to TrackIt API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
