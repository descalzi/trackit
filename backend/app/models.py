from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.database import PackageStatus


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
    is_admin: bool = False

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
    courier: Optional[str] = None  # Courier code (e.g., "evri", "dhl")
    note: Optional[str] = None


class PackageCreate(PackageBase):
    """Package creation model"""
    delivery_location_id: Optional[str] = None  # Target delivery location


class PackageUpdate(BaseModel):
    """Package update model - all fields optional"""
    courier: Optional[str] = None  # Courier code (e.g., "evri", "dhl")
    note: Optional[str] = None
    archived: Optional[bool] = None
    delivery_location_id: Optional[str] = None  # Target delivery location


class LocationInfo(BaseModel):
    """Location information for display"""
    location_string: str
    normalized_location: str
    alias: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    display_name: Optional[str] = None
    country_code: Optional[str] = None

    class Config:
        from_attributes = True


class Package(PackageBase):
    """Package response model"""
    id: str
    user_id: str
    delivery_location_id: Optional[str] = None
    ship24_tracker_id: Optional[str] = None
    last_status: Optional[PackageStatus] = None
    last_location_id: Optional[str] = None
    last_location: Optional[LocationInfo] = None  # Joined location data
    last_updated: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    origin_country: Optional[str] = None
    destination_country: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    detected_courier: Optional[str] = None
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
    courier_code: Optional[str] = None


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


# Geocoding models
class GeocodedLocation(BaseModel):
    """Geocoded location with event details"""
    event_id: str
    location_string: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    display_name: Optional[str] = None
    timestamp: datetime
    status: PackageStatus


class CountryLocation(BaseModel):
    """Country location information"""
    country_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PackageLocationsResponse(BaseModel):
    """Response model for package locations"""
    locations: List[GeocodedLocation]
    origin: CountryLocation
    destination: CountryLocation


# Admin models
class LocationAdmin(BaseModel):
    """Location model for admin page"""
    location_string: str
    normalized_location: str
    alias: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    display_name: Optional[str] = None
    country_code: Optional[str] = None
    geocoded_at: Optional[datetime] = None
    geocoding_failed: bool
    usage_count: int = 0  # Number of events using this location

    class Config:
        from_attributes = True


class LocationAliasUpdate(BaseModel):
    """Request model for updating location alias"""
    alias: Optional[str] = None


# Delivery Location models
class DeliveryLocationCreate(BaseModel):
    """Request model for creating a delivery location"""
    name: str
    address: str


class DeliveryLocationUpdate(BaseModel):
    """Request model for updating a delivery location"""
    name: Optional[str] = None
    address: Optional[str] = None


class DeliveryLocation(BaseModel):
    """Response model for delivery location"""
    id: str
    user_id: str
    name: str
    address: str
    latitude: float
    longitude: float
    display_name: Optional[str] = None
    country_code: Optional[str] = None
    geocoded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GeocodeRequest(BaseModel):
    """Request model for geocoding an address"""
    address: str
