from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.database import PackageStatus, CourierType


# Authentication models
class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth authentication"""
    token: str


class User(BaseModel):
    """User response model"""
    id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Response model for successful authentication"""
    access_token: str
    token_type: str = "bearer"
    user: User


# Package models
class PackageBase(BaseModel):
    """Base package model"""
    tracking_number: str
    courier: Optional[CourierType] = None
    nickname: Optional[str] = None
    description: Optional[str] = None


class PackageCreate(PackageBase):
    """Package creation model"""
    pass


class PackageUpdate(BaseModel):
    """Package update model - all fields optional"""
    courier: Optional[CourierType] = None
    nickname: Optional[str] = None
    description: Optional[str] = None
    archived: Optional[bool] = None


class Package(PackageBase):
    """Package response model"""
    id: str
    user_id: str
    ship24_tracker_id: Optional[str] = None
    last_status: Optional[PackageStatus] = None
    last_location: Optional[str] = None
    last_updated: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Tracking Event models
class TrackingEventData(BaseModel):
    """Tracking event data from Ship24"""
    status: PackageStatus
    location: Optional[str] = None
    timestamp: datetime
    description: Optional[str] = None
    courier_event_code: Optional[str] = None


class TrackingEvent(TrackingEventData):
    """Tracking event response model"""
    id: str
    package_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Tracking lookup models
class TrackingLookupRequest(BaseModel):
    """Request model for tracking lookup"""
    tracking_number: str
    courier: Optional[str] = None


class TrackingLookupResponse(BaseModel):
    """Response model for tracking lookup"""
    tracking_number: str
    status: PackageStatus
    courier: str
    events: List[TrackingEventData]
    estimated_delivery: Optional[datetime] = None
    ship24_tracker_id: Optional[str] = None
