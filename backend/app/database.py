from sqlalchemy import create_engine, Column, String, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import enum

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trackit.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Enums
class PackageStatus(str, enum.Enum):
    IN_TRANSIT = "In Transit"
    OUT_FOR_DELIVERY = "Out for Delivery"
    DELIVERED = "Delivered"
    EXCEPTION = "Exception"
    PENDING = "Pending"
    UNKNOWN = "Unknown"


# Models
class DBUser(Base):
    """User model - stores Google OAuth user information"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Google user ID
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    picture = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)  # Admin flag (manually managed)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    packages = relationship("DBPackage", back_populates="user", cascade="all, delete-orphan")
    delivery_locations = relationship("DBDeliveryLocation", back_populates="user", cascade="all, delete-orphan")


class DBDeliveryLocation(Base):
    """Delivery Location model - stores user-defined delivery locations"""
    __tablename__ = "delivery_locations"

    id = Column(String, primary_key=True, index=True)  # UUID
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # Location name (e.g., "Home", "Office")
    address = Column(String, nullable=False)  # User-provided address
    latitude = Column(Float, nullable=False)  # Required for map display
    longitude = Column(Float, nullable=False)  # Required for map display
    display_name = Column(String, nullable=True)  # Full address from geocoding
    country_code = Column(String(2), nullable=True)
    geocoded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    user = relationship("DBUser", back_populates="delivery_locations")
    packages = relationship("DBPackage", back_populates="delivery_location")


class DBPackage(Base):
    """Package model - stores saved packages for tracking"""
    __tablename__ = "packages"

    id = Column(String, primary_key=True, index=True)  # UUID
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    tracking_number = Column(String, nullable=False, index=True)
    courier = Column(String, nullable=True)  # Optional courier code (e.g., "evri", "dhl")
    note = Column(String, nullable=True)  # User note for package
    delivery_location_id = Column(String, ForeignKey("delivery_locations.id"), nullable=True)  # Target delivery location

    # Ship24 cached data
    ship24_tracker_id = Column(String, nullable=True)  # Ship24 tracker ID for caching
    last_status = Column(SQLEnum(PackageStatus), nullable=True)  # Cached status
    last_location = Column(String, nullable=True)  # Cached location
    last_updated = Column(DateTime, nullable=True)  # When tracking was last fetched
    delivered_at = Column(DateTime, nullable=True)  # Delivery timestamp

    # Shipment details
    origin_country = Column(String, nullable=True)  # Origin country code (e.g., "US")
    destination_country = Column(String, nullable=True)  # Destination country code (e.g., "CN")
    estimated_delivery = Column(DateTime, nullable=True)  # Estimated delivery date from courier
    detected_courier = Column(String, nullable=True)  # Actual detected courier code from Ship24 (e.g., "evri", "us-post")

    archived = Column(Boolean, default=False)  # Archive delivered/old packages
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    user = relationship("DBUser", back_populates="packages")
    delivery_location = relationship("DBDeliveryLocation", back_populates="packages")
    tracking_events = relationship("DBTrackingEvent", back_populates="package", cascade="all, delete-orphan")


class DBLocation(Base):
    """Location model - caches geocoded locations for reuse"""
    __tablename__ = "locations"

    location_string = Column(String, primary_key=True, index=True)  # "East Grinstead DO"
    normalized_location = Column(String, nullable=False)  # "East Grinstead"
    alias = Column(String, nullable=True)  # User-provided alias for failed geocoding
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    display_name = Column(String, nullable=True)  # Full address from Nominatim
    country_code = Column(String(2), nullable=True)
    geocoded_at = Column(DateTime, nullable=True)
    geocoding_failed = Column(Boolean, default=False)

    # Relationships
    tracking_events = relationship("DBTrackingEvent", back_populates="location_ref")


class DBTrackingEvent(Base):
    """Tracking Event model - stores tracking history/checkpoints"""
    __tablename__ = "tracking_events"

    id = Column(String, primary_key=True, index=True)  # UUID
    package_id = Column(String, ForeignKey("packages.id"), nullable=False, index=True)
    status = Column(SQLEnum(PackageStatus), nullable=False)
    location = Column(String, nullable=True)  # Event location (keep for backward compatibility)
    location_id = Column(String, ForeignKey("locations.location_string"), nullable=True)  # FK to locations
    delivery_location_id = Column(String, ForeignKey("delivery_locations.id"), nullable=True)  # FK to delivery_locations (for delivered packages)
    timestamp = Column(DateTime, nullable=False, index=True)  # Event timestamp from courier
    description = Column(Text, nullable=True)  # Event description
    courier_event_code = Column(String, nullable=True)  # Raw courier event code (status code)
    courier_code = Column(String, nullable=True)  # Courier handling this event (e.g., "usps", "evri")
    created_at = Column(DateTime, default=datetime.now)  # When we fetched this event

    # Relationships
    package = relationship("DBPackage", back_populates="tracking_events")
    location_ref = relationship("DBLocation", back_populates="tracking_events")
    delivery_location_ref = relationship("DBDeliveryLocation")


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
