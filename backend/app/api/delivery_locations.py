from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import uuid4
from datetime import datetime

from app.database import get_db, DBUser, DBDeliveryLocation, DBPackage, DBTrackingEvent
from app.models import DeliveryLocation, DeliveryLocationCreate, DeliveryLocationUpdate, GeocodeRequest
from app.api.auth import get_current_user
from app.services.geocoding_service import get_geocoding_service
from app.database import PackageStatus

router = APIRouter()


@router.get("/delivery-locations", response_model=List[DeliveryLocation])
async def get_delivery_locations(
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all delivery locations for the current user."""
    locations = db.query(DBDeliveryLocation).filter(
        DBDeliveryLocation.user_id == current_user.id
    ).order_by(DBDeliveryLocation.created_at.desc()).all()

    return locations


@router.post("/delivery-locations/geocode")
async def geocode_address(
    geocode_request: GeocodeRequest,
    current_user: DBUser = Depends(get_current_user)
):
    """
    Geocode an address and return coordinates.
    This is used before saving to validate the address.
    """
    geocoding_service = get_geocoding_service()
    result = await geocoding_service.geocode_location(geocode_request.address)

    if not result:
        raise HTTPException(
            status_code=400,
            detail="Unable to geocode the provided address. Please check the address and try again."
        )

    return {
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "display_name": result.get("display_name"),
        "country_code": result.get("country_code")
    }


@router.post("/delivery-locations", response_model=DeliveryLocation)
async def create_delivery_location(
    location_data: DeliveryLocationCreate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new delivery location for the current user.
    Address must be geocoded first using the geocode endpoint.
    """
    # Geocode the address
    geocoding_service = get_geocoding_service()
    geocode_result = await geocoding_service.geocode_location(location_data.address)

    if not geocode_result:
        raise HTTPException(
            status_code=400,
            detail="Unable to geocode the provided address. Please check the address and try again."
        )

    # Create the delivery location
    db_location = DBDeliveryLocation(
        id=str(uuid4()),
        user_id=current_user.id,
        name=location_data.name,
        address=location_data.address,
        latitude=geocode_result["latitude"],
        longitude=geocode_result["longitude"],
        display_name=geocode_result.get("display_name"),
        country_code=geocode_result.get("country_code"),
        geocoded_at=datetime.now()
    )

    db.add(db_location)
    db.commit()
    db.refresh(db_location)

    return db_location


@router.put("/delivery-locations/{location_id}", response_model=DeliveryLocation)
async def update_delivery_location(
    location_id: str,
    location_data: DeliveryLocationUpdate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a delivery location.
    If address is changed, it will be re-geocoded.
    This will also update all packages using this location.
    """
    # Get the location
    db_location = db.query(DBDeliveryLocation).filter(
        DBDeliveryLocation.id == location_id,
        DBDeliveryLocation.user_id == current_user.id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Delivery location not found")

    # Update name if provided
    if location_data.name is not None:
        db_location.name = location_data.name

    # If address changed, re-geocode
    if location_data.address is not None and location_data.address != db_location.address:
        geocoding_service = get_geocoding_service()
        geocode_result = await geocoding_service.geocode_location(location_data.address)

        if not geocode_result:
            raise HTTPException(
                status_code=400,
                detail="Unable to geocode the provided address. Please check the address and try again."
            )

        db_location.address = location_data.address
        db_location.latitude = geocode_result["latitude"]
        db_location.longitude = geocode_result["longitude"]
        db_location.display_name = geocode_result.get("display_name")
        db_location.country_code = geocode_result.get("country_code")
        db_location.geocoded_at = datetime.now()

        # Update all delivered packages using this location
        # Find all packages with this delivery location that are delivered
        packages = db.query(DBPackage).filter(
            DBPackage.delivery_location_id == location_id,
            DBPackage.last_status == PackageStatus.DELIVERED
        ).all()

        # For each package, update or create the delivery tracking event
        for package in packages:
            # Find existing delivery event
            delivery_event = db.query(DBTrackingEvent).filter(
                DBTrackingEvent.package_id == package.id,
                DBTrackingEvent.status == PackageStatus.DELIVERED
            ).order_by(DBTrackingEvent.timestamp.desc()).first()

            if delivery_event:
                # Update the event location to point to the updated coordinates
                # We don't modify the event itself but the location will be updated
                # through the location reference
                pass

    db_location.updated_at = datetime.now()
    db.commit()
    db.refresh(db_location)

    return db_location


@router.delete("/delivery-locations/{location_id}")
async def delete_delivery_location(
    location_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a delivery location.
    This will remove the delivery location reference from packages and tracking events.
    """
    # Get the location
    db_location = db.query(DBDeliveryLocation).filter(
        DBDeliveryLocation.id == location_id,
        DBDeliveryLocation.user_id == current_user.id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail="Delivery location not found")

    # Remove reference from tracking events
    db.query(DBTrackingEvent).filter(
        DBTrackingEvent.delivery_location_id == location_id
    ).update({"delivery_location_id": None})

    # For delivered packages that were using this location, clear delivery_location_id from events
    # and update last_location_id to fall back to courier location
    affected_packages = db.query(DBPackage).filter(
        DBPackage.delivery_location_id == location_id,
        DBPackage.last_status == PackageStatus.DELIVERED
    ).all()

    for package in affected_packages:
        # Find the delivered event and clear its delivery_location_id
        delivered_event = db.query(DBTrackingEvent).filter(
            DBTrackingEvent.package_id == package.id,
            DBTrackingEvent.status == PackageStatus.DELIVERED
        ).order_by(DBTrackingEvent.timestamp.desc()).first()

        if delivered_event:
            delivered_event.delivery_location_id = None
            # Manually update last_location_id to courier location since trigger only fires on INSERT
            package.last_location_id = delivered_event.location_id

    # Remove reference from packages
    db.query(DBPackage).filter(
        DBPackage.delivery_location_id == location_id
    ).update({"delivery_location_id": None})

    # Delete the location
    db.delete(db_location)
    db.commit()

    return {"success": True, "message": "Delivery location deleted"}
