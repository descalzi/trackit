from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db, DBUser, DBLocation, DBTrackingEvent
from app.models import LocationAdmin, LocationAliasUpdate
from app.api.auth import get_current_user
from app.services.geocoding_service import get_geocoding_service
import asyncio

router = APIRouter()


async def _retry_geocode_location(location_string: str):
    """Background task to retry geocoding a location with alias."""
    from app.database import SessionLocal
    print(f"Retrying geocoding for location: {location_string}")
    db = SessionLocal()
    geocoding_service = get_geocoding_service()
    try:
        await geocoding_service.geocode_and_cache(location_string, db)
        print(f"Finished retrying geocoding for: {location_string}")
    except Exception as e:
        print(f"Error retrying geocoding for {location_string}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.get("/locations", response_model=List[LocationAdmin])
async def get_all_locations(
    failed_only: bool = False,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all locations with usage counts.
    Optionally filter to show only failed geocoding attempts.
    """
    # Build query
    query = db.query(
        DBLocation,
        func.count(DBTrackingEvent.id).label('usage_count')
    ).outerjoin(
        DBTrackingEvent,
        DBLocation.location_string == DBTrackingEvent.location_id
    ).group_by(DBLocation.location_string)

    # Filter for failed only
    if failed_only:
        query = query.filter(DBLocation.geocoding_failed == True)

    # Order by usage count descending
    query = query.order_by(func.count(DBTrackingEvent.id).desc())

    results = query.all()

    # Convert to response model
    locations = []
    for location, usage_count in results:
        loc_dict = {
            'location_string': location.location_string,
            'normalized_location': location.normalized_location,
            'alias': location.alias,
            'latitude': location.latitude,
            'longitude': location.longitude,
            'display_name': location.display_name,
            'country_code': location.country_code,
            'geocoded_at': location.geocoded_at,
            'geocoding_failed': location.geocoding_failed,
            'usage_count': usage_count or 0
        }
        locations.append(LocationAdmin(**loc_dict))

    return locations


@router.put("/locations/{location_string}/alias")
async def update_location_alias(
    location_string: str,
    update: LocationAliasUpdate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the alias for a location.
    Resets geocoding status and triggers a retry.
    """
    # Get the location
    location = db.query(DBLocation).filter(
        DBLocation.location_string == location_string
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Update alias
    location.alias = update.alias

    # Reset geocoding status to trigger retry
    location.geocoded_at = None
    location.geocoding_failed = False
    location.latitude = None
    location.longitude = None
    location.display_name = None
    location.country_code = None

    db.commit()
    db.refresh(location)

    # Trigger background geocoding with new alias
    if update.alias:
        asyncio.create_task(_retry_geocode_location(location_string))

    return {"success": True, "message": "Alias updated and geocoding retry scheduled"}


@router.post("/locations/{location_string}/retry")
async def retry_geocode_location(
    location_string: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retry geocoding for a specific location.
    """
    # Get the location
    location = db.query(DBLocation).filter(
        DBLocation.location_string == location_string
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Reset geocoding status
    location.geocoded_at = None
    location.geocoding_failed = False
    location.latitude = None
    location.longitude = None
    location.display_name = None
    location.country_code = None

    db.commit()

    # Trigger background geocoding
    asyncio.create_task(_retry_geocode_location(location_string))

    return {"success": True, "message": "Geocoding retry scheduled"}
