from sqlalchemy import create_engine, Column, String, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
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


class CourierType(str, enum.Enum):
    EVRI = "Evri"
    ROYAL_MAIL = "Royal Mail"
    DPD = "DPD"
    AUTO_DETECT = "Auto Detect"
    OTHER = "Other"


# Models
class DBUser(Base):
    """User model - stores Google OAuth user information"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Google user ID
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    picture = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    packages = relationship("DBPackage", back_populates="user", cascade="all, delete-orphan")


class DBPackage(Base):
    """Package model - stores saved packages for tracking"""
    __tablename__ = "packages"

    id = Column(String, primary_key=True, index=True)  # UUID
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    tracking_number = Column(String, nullable=False, index=True)
    courier = Column(SQLEnum(CourierType), nullable=True)  # Optional courier selection
    nickname = Column(String, nullable=True)  # User-friendly name
    description = Column(Text, nullable=True)  # Package description

    # Ship24 cached data
    ship24_tracker_id = Column(String, nullable=True)  # Ship24 tracker ID for caching
    last_status = Column(SQLEnum(PackageStatus), nullable=True)  # Cached status
    last_location = Column(String, nullable=True)  # Cached location
    last_updated = Column(DateTime, nullable=True)  # When tracking was last fetched
    delivered_at = Column(DateTime, nullable=True)  # Delivery timestamp

    archived = Column(Boolean, default=False)  # Archive delivered/old packages
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    user = relationship("DBUser", back_populates="packages")
    tracking_events = relationship("DBTrackingEvent", back_populates="package", cascade="all, delete-orphan")


class DBTrackingEvent(Base):
    """Tracking Event model - stores tracking history/checkpoints"""
    __tablename__ = "tracking_events"

    id = Column(String, primary_key=True, index=True)  # UUID
    package_id = Column(String, ForeignKey("packages.id"), nullable=False, index=True)
    status = Column(SQLEnum(PackageStatus), nullable=False)
    location = Column(String, nullable=True)  # Event location
    timestamp = Column(DateTime, nullable=False, index=True)  # Event timestamp from courier
    description = Column(Text, nullable=True)  # Event description
    courier_event_code = Column(String, nullable=True)  # Raw courier event code
    created_at = Column(DateTime, default=datetime.now)  # When we fetched this event

    # Relationships
    package = relationship("DBPackage", back_populates="tracking_events")


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
