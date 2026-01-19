from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db, DBPackage, DBUser, DBTrackingEvent, PackageStatus
from app.models import Package, PackageCreate, PackageUpdate, TrackingEvent
from app.api.auth import get_current_user
from app.services.ship24_service import Ship24Service, Ship24Error
import uuid

router = APIRouter()


@router.get("", response_model=List[Package])
async def get_packages(
    archived: bool = False,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all packages for the current user"""
    packages = db.query(DBPackage).filter(
        DBPackage.user_id == current_user.id,
        DBPackage.archived == archived
    ).all()
    return packages


@router.post("", response_model=Package, status_code=201)
async def create_package(
    package: PackageCreate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new package for the current user and fetch initial tracking data"""
    package_id = str(uuid.uuid4())

    # Create package in database
    db_package = DBPackage(
        id=package_id,
        user_id=current_user.id,
        tracking_number=package.tracking_number,
        courier=package.courier,
        note=package.note
    )

    # Try to fetch tracking data from Ship24
    ship24 = Ship24Service()
    try:
        result = await ship24.track_package(
            package.tracking_number,
            package.courier.value if package.courier else None
        )

        # Populate tracking data
        db_package.ship24_tracker_id = result.get("tracker_id")
        db_package.last_status = result["status"]
        db_package.last_location = result["location"]
        db_package.last_updated = datetime.now()

        # Populate shipment details
        db_package.origin_country = result.get("origin_country")
        db_package.destination_country = result.get("destination_country")
        db_package.estimated_delivery = result.get("estimated_delivery")
        db_package.detected_courier = result.get("courier")  # Store the detected courier code

        # Mark as delivered if applicable
        if result["status"] == PackageStatus.DELIVERED:
            db_package.delivered_at = datetime.now()

        # Save tracking events
        for event_data in result["events"]:
            db_event = DBTrackingEvent(
                id=str(uuid.uuid4()),
                package_id=package_id,
                status=event_data["status"],
                location=event_data.get("location"),
                timestamp=event_data["timestamp"],
                description=event_data.get("description"),
                courier_event_code=event_data.get("courier_event_code")
            )
            db.add(db_event)

    except Ship24Error as e:
        # If Ship24 fails, still save the package without tracking data
        print(f"Failed to fetch tracking data: {e}")

    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    return db_package


@router.get("/{package_id}", response_model=Package)
async def get_package(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific package by ID"""
    package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    return package


@router.put("/{package_id}", response_model=Package)
async def update_package(
    package_id: str,
    package_update: PackageUpdate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a package's information"""
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Update only provided fields
    if package_update.courier is not None:
        db_package.courier = package_update.courier
    if package_update.note is not None:
        db_package.note = package_update.note
    if package_update.archived is not None:
        db_package.archived = package_update.archived

    db.commit()
    db.refresh(db_package)
    return db_package


@router.delete("/{package_id}", status_code=204)
async def delete_package(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a package"""
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    db.delete(db_package)
    db.commit()
    return None


@router.get("/{package_id}/events", response_model=List[TrackingEvent])
async def get_package_events(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tracking events for a package"""
    # Verify package ownership
    package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Get events sorted by timestamp (newest first)
    events = db.query(DBTrackingEvent).filter(
        DBTrackingEvent.package_id == package_id
    ).order_by(DBTrackingEvent.timestamp.desc()).all()

    return events
