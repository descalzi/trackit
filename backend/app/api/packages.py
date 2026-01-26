from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import re
from app.database import get_db, DBPackage, DBUser, DBTrackingEvent, PackageStatus, DBLocation, DBDeliveryLocation
from app.models import Package, PackageCreate, PackageUpdate, TrackingEvent, LocationInfo
from app.api.auth import get_current_user
from app.services.ship24_service import Ship24Service, Ship24Error
from app.services.geocoding_service import get_geocoding_service
import uuid

router = APIRouter()


def apply_delivery_location_override(db_package: DBPackage, db: Session) -> None:
    """
    Override last_location with delivery location if package is delivered.

    For delivered packages with a delivery_location_id, this function replaces
    the courier location (from last_location) with the user's delivery location.
    This ensures delivered packages show the final delivery address instead of
    the last courier location.
    """
    if db_package.last_status == PackageStatus.DELIVERED and db_package.delivery_location_id:
        # Find the most recent delivered event
        delivered_event = db.query(DBTrackingEvent).filter(
            DBTrackingEvent.package_id == db_package.id,
            DBTrackingEvent.status == PackageStatus.DELIVERED
        ).order_by(DBTrackingEvent.timestamp.desc()).first()

        # If the delivered event has a delivery_location_id, use that instead of courier location
        if delivered_event and delivered_event.delivery_location_id:
            delivery_location = db.query(DBDeliveryLocation).filter(
                DBDeliveryLocation.id == delivered_event.delivery_location_id
            ).first()

            if delivery_location:
                # Override last_location with a DBLocation object that contains delivery location data
                # Create an actual DBLocation instance (not persisted) for Pydantic serialization
                mock_location = DBLocation(
                    location_string=delivery_location.name,
                    normalized_location=delivery_location.name,
                    alias=None,
                    latitude=delivery_location.latitude,
                    longitude=delivery_location.longitude,
                    display_name=delivery_location.display_name,
                    country_code=delivery_location.country_code,
                    geocoding_failed=False
                )
                db_package.last_location = mock_location
                db_package.last_location_id = delivery_location.name  # Set to name for reference


def extract_location_from_description(description: str) -> Optional[str]:
    """
    Extract location from tracking event descriptions that contain bracketed locations.
    Examples:
        "[Shatian Town] Processing at sorting center" -> "Shatian Town"
        "[SHANGHAI CITY] Departed from facility" -> "SHANGHAI CITY"
        "Package delivered" -> None
    """
    if not description:
        return None

    # Match text within square brackets at the start of the description
    match = re.match(r'^\[([^\]]+)\]', description)
    if match:
        location = match.group(1).strip()
        return location

    return None


@router.get("", response_model=List[Package])
async def get_packages(
    archived: bool = False,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all packages for the current user"""
    from sqlalchemy.orm import joinedload

    packages = db.query(DBPackage).options(
        joinedload(DBPackage.last_location)
    ).filter(
        DBPackage.user_id == current_user.id,
        DBPackage.archived == archived
    ).all()

    # Apply delivery location override for delivered packages
    for package in packages:
        apply_delivery_location_override(package, db)

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
        note=package.note,
        delivery_location_id=package.delivery_location_id
    )

    # Try to fetch tracking data from Ship24
    ship24 = Ship24Service()
    try:
        result = await ship24.track_package(
            package.tracking_number,
            package.courier
        )

        # Populate tracking data
        db_package.ship24_tracker_id = result.get("tracker_id")
        db_package.last_status = result["status"]
        # last_location_id will be set by the trigger after events are inserted
        db_package.last_updated = datetime.now()

        # Populate shipment details
        db_package.origin_country = result.get("origin_country")
        db_package.destination_country = result.get("destination_country")
        db_package.estimated_delivery = result.get("estimated_delivery")
        db_package.detected_courier = result.get("courier")  # Store the detected courier code

        # Mark as delivered if applicable
        if result["status"] == PackageStatus.DELIVERED:
            db_package.delivered_at = datetime.now()

        # Save tracking events initially
        delivered_event = None
        for event_data in result["events"]:
            location_str = event_data.get("location")

            # If no location provided, try to extract from description
            if not location_str:
                description = event_data.get("description", "")
                location_str = extract_location_from_description(description)

            # Clean up location string - convert string "null" to None
            if location_str and location_str.lower() == "null":
                location_str = None

            # Ensure location exists in locations table
            if location_str:
                existing_location = db.query(DBLocation).filter(
                    DBLocation.location_string == location_str
                ).first()

                if not existing_location:
                    # Create new location entry
                    geocoding_service = get_geocoding_service()
                    normalized = geocoding_service.normalize_location(location_str)
                    new_location = DBLocation(
                        location_string=location_str,
                        normalized_location=normalized,
                        geocoding_failed=False
                    )
                    db.add(new_location)
                    db.flush()  # Flush to make it available for the event

            event_id = str(uuid.uuid4())
            db_event = DBTrackingEvent(
                id=event_id,
                package_id=package_id,
                status=event_data["status"],
                location=location_str,
                location_id=location_str if location_str else None,  # Link to location
                timestamp=event_data["timestamp"],
                description=event_data.get("description"),
                courier_event_code=event_data.get("courier_event_code"),
                courier_code=event_data.get("courier_code")
            )
            db.add(db_event)

            # Track delivered event object for later processing
            if event_data["status"] == PackageStatus.DELIVERED:
                delivered_event = db_event

        # Apply delivery location if package is delivered and has delivery_location_id
        if delivered_event and db_package.delivery_location_id:
            # Set delivery_location_id directly on the event object (already in session)
            delivered_event.delivery_location_id = db_package.delivery_location_id

    except Ship24Error as e:
        # If Ship24 fails, still save the package without tracking data
        print(f"Failed to fetch tracking data: {e}")

    db.add(db_package)
    db.commit()
    db.refresh(db_package)

    # Trigger will automatically set last_location_id based on most recent tracking event
    # Refresh again to get the updated last_location_id and joined location data
    from sqlalchemy.orm import joinedload
    db_package = db.query(DBPackage).options(
        joinedload(DBPackage.last_location)
    ).filter(DBPackage.id == package_id).first()

    # Apply delivery location override for delivered packages
    if db_package:
        apply_delivery_location_override(db_package, db)

    return db_package


@router.get("/{package_id}", response_model=Package)
async def get_package(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific package by ID"""
    from sqlalchemy.orm import joinedload

    package = db.query(DBPackage).options(
        joinedload(DBPackage.last_location)
    ).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Apply delivery location override for delivered packages
    apply_delivery_location_override(package, db)

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

    # Handle delivery_location_id update
    # Check if delivery_location_id was provided in the update (even if None/null to clear it)
    delivery_location_changed = False
    update_dict = package_update.model_dump(exclude_unset=True)
    if 'delivery_location_id' in update_dict:
        new_value = package_update.delivery_location_id
        delivery_location_changed = db_package.delivery_location_id != new_value
        db_package.delivery_location_id = new_value

    # If package is delivered and delivery location was changed, update the delivered event
    # The trigger will handle updating last_location_id automatically
    if delivery_location_changed and db_package.last_status == PackageStatus.DELIVERED:
        # Find the most recent DELIVERED event
        delivered_event = db.query(DBTrackingEvent).filter(
            DBTrackingEvent.package_id == package_id,
            DBTrackingEvent.status == PackageStatus.DELIVERED
        ).order_by(DBTrackingEvent.timestamp.desc()).first()

        if delivered_event:
            # Set or clear the delivery_location_id on the event
            delivered_event.delivery_location_id = db_package.delivery_location_id
            # Note: We don't need to manually update last_location_id here
            # as the trigger will handle it when events change

    db.commit()

    # Refresh with joined location data
    from sqlalchemy.orm import joinedload
    db_package = db.query(DBPackage).options(
        joinedload(DBPackage.last_location)
    ).filter(DBPackage.id == package_id).first()

    # Apply delivery location override for delivered packages
    if db_package:
        apply_delivery_location_override(db_package, db)

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
