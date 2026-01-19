from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime
import asyncio
import re
from app.database import get_db, DBPackage, DBUser, DBTrackingEvent, PackageStatus, DBLocation, SessionLocal
from app.models import (
    TrackingLookupRequest, TrackingLookupResponse, Package, TrackingEventData,
    PackageLocationsResponse, GeocodedLocation, CountryLocation
)
from app.api.auth import get_current_user
from app.services.ship24_service import Ship24Service, Ship24Error, Ship24RateLimitError, Ship24NotFoundError
from app.services.geocoding_service import get_geocoding_service
import uuid

router = APIRouter()


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
        print(f"  Extracted location from description: '{location}' from '{description}'")
        return location

    return None

# In-memory cache for couriers (refreshed periodically)
_couriers_cache: Optional[List[Dict]] = None


@router.get("/couriers")
async def get_couriers():
    """
    Get list of all supported couriers from Ship24
    Results are cached to avoid excessive API calls
    """
    global _couriers_cache

    # Return cached data if available
    if _couriers_cache is not None:
        return {"couriers": _couriers_cache}

    # Fetch from Ship24 if not cached
    ship24 = Ship24Service()
    try:
        couriers = await ship24.get_couriers()
        _couriers_cache = couriers
        return {"couriers": couriers}
    except Ship24RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    except Ship24Error as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch couriers: {str(e)}")


@router.post("/lookup", response_model=TrackingLookupResponse)
async def lookup_tracking(
    request: TrackingLookupRequest,
    current_user: Optional[DBUser] = Depends(get_current_user)
):
    """
    Look up tracking number without saving
    This allows users to preview tracking info before saving
    """
    ship24 = Ship24Service()

    try:
        result = await ship24.track_package(request.tracking_number, request.courier)

        # Convert events to TrackingEventData
        events = [TrackingEventData(**event) for event in result["events"]]

        return TrackingLookupResponse(
            tracking_number=result["tracking_number"],
            status=result["status"],
            courier=result["courier"],
            events=events,
            estimated_delivery=result.get("estimated_delivery"),
            ship24_tracker_id=result.get("tracker_id")
        )

    except Ship24RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    except Ship24NotFoundError:
        raise HTTPException(status_code=404, detail="Tracking number not found.")
    except Ship24Error as e:
        raise HTTPException(status_code=500, detail=f"Tracking service error: {str(e)}")


@router.post("/refresh/{package_id}", response_model=Package)
async def refresh_tracking(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh tracking data for a saved package
    Fetches latest data from Ship24 and updates package + events in database
    """
    print(f"DEBUG: Refreshing package_id={package_id}, current_user.id={current_user.id}")

    # Get package and verify ownership
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    print(f"DEBUG: db_package found: {db_package is not None}")
    if db_package:
        print(f"DEBUG: Package tracking_number={db_package.tracking_number}, user_id={db_package.user_id}")

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    ship24 = Ship24Service()

    try:
        # Use cached tracker_id if available, otherwise tracking number
        if db_package.ship24_tracker_id:
            try:
                result = await ship24.get_tracker_results(db_package.ship24_tracker_id)
            except Ship24NotFoundError:
                # Tracker not found, try with tracking number
                result = await ship24.track_package(db_package.tracking_number, db_package.courier.value if db_package.courier else None)
        else:
            result = await ship24.track_package(db_package.tracking_number, db_package.courier.value if db_package.courier else None)

        # Update package with latest data
        db_package.ship24_tracker_id = result.get("tracker_id")
        db_package.last_status = result["status"]
        db_package.last_location = result["location"]
        db_package.last_updated = datetime.now()

        # Update shipment details
        db_package.origin_country = result.get("origin_country")
        db_package.destination_country = result.get("destination_country")
        db_package.estimated_delivery = result.get("estimated_delivery")
        db_package.detected_courier = result.get("courier")  # Store the detected courier code

        # Update delivered_at if status is delivered
        if result["status"] == PackageStatus.DELIVERED and not db_package.delivered_at:
            db_package.delivered_at = datetime.now()

        # Save new events (deduplicate by timestamp + description)
        print(f"DEBUG: Processing {len(result['events'])} events from Ship24")
        new_locations = set()

        for event_data in result["events"]:
            # Check if event already exists
            existing_event = db.query(DBTrackingEvent).filter(
                DBTrackingEvent.package_id == package_id,
                DBTrackingEvent.timestamp == event_data["timestamp"],
                DBTrackingEvent.description == event_data.get("description", "")
            ).first()

            if not existing_event:
                print(f"DEBUG: Saving new event: {event_data.get('description')} at {event_data['timestamp']}")
                location_str = event_data.get("location")

                # If no location provided, try to extract from description
                if not location_str:
                    description = event_data.get("description", "")
                    location_str = extract_location_from_description(description)

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
                        new_locations.add(location_str)
                        print(f"  Created new location entry: {location_str}")

                db_event = DBTrackingEvent(
                    id=str(uuid.uuid4()),
                    package_id=package_id,
                    status=event_data["status"],
                    location=location_str,
                    location_id=location_str if location_str else None,  # Link to location
                    timestamp=event_data["timestamp"],
                    description=event_data.get("description"),
                    courier_event_code=event_data.get("courier_event_code")
                )
                db.add(db_event)
            else:
                print(f"DEBUG: Skipping duplicate event: {event_data.get('description')}")

        db.commit()
        db.refresh(db_package)

        # Update last_location from most recent event if Ship24 didn't provide it
        if not db_package.last_location:
            latest_event = db.query(DBTrackingEvent).filter(
                DBTrackingEvent.package_id == package_id,
                DBTrackingEvent.location != None,
                DBTrackingEvent.location != ''
            ).order_by(DBTrackingEvent.timestamp.desc()).first()

            if latest_event and latest_event.location:
                db_package.last_location = latest_event.location
                db.commit()
                db.refresh(db_package)
                print(f"DEBUG: Set last_location to most recent event location: {latest_event.location}")

        # Trigger background geocoding for new locations
        if new_locations:
            print(f"DEBUG: Triggering background geocoding for {len(new_locations)} new locations")
            asyncio.create_task(_geocode_new_locations(list(new_locations)))

        return db_package

    except Ship24RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    except Ship24NotFoundError:
        raise HTTPException(status_code=404, detail="Tracking number not found.")
    except Ship24Error as e:
        raise HTTPException(status_code=500, detail=f"Tracking service error: {str(e)}")


async def _geocode_new_locations(location_strings: List[str]):
    """Background task to geocode newly added locations."""
    print(f"Starting background geocoding for {len(location_strings)} new locations")
    db = SessionLocal()
    geocoding_service = get_geocoding_service()
    try:
        for location_str in location_strings:
            await geocoding_service.geocode_and_cache(location_str, db)
        print(f"Finished geocoding new locations")
    except Exception as e:
        print(f"Background geocoding error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


async def _background_geocode(package_id: str, db: Session):
    """Background task to geocode package locations."""
    print(f"Starting background geocoding for package {package_id}")
    geocoding_service = get_geocoding_service()
    try:
        count = await geocoding_service.batch_geocode_package_events(package_id, db)
        print(f"Geocoded {count} locations for package {package_id}")
    except Exception as e:
        print(f"Background geocoding error for package {package_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.get("/locations/{package_id}", response_model=PackageLocationsResponse)
async def get_package_locations(
    package_id: str,
    background_tasks: BackgroundTasks,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get geocoded locations for a package's tracking events.
    Triggers background geocoding for any locations that haven't been geocoded yet.
    """
    # Verify package ownership
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Trigger background geocoding for un-geocoded locations
    # Create a new session for the background task
    background_tasks.add_task(_background_geocode, package_id, SessionLocal())

    # Get all tracking events with their locations
    events = db.query(DBTrackingEvent).filter(
        DBTrackingEvent.package_id == package_id
    ).order_by(DBTrackingEvent.timestamp).all()

    # Build response
    locations = []
    for event in events:
        # Get location data if available
        location_data = None
        if event.location_id:
            location_data = db.query(DBLocation).filter(
                DBLocation.location_string == event.location_id
            ).first()

        locations.append(GeocodedLocation(
            event_id=event.id,
            location_string=event.location,
            latitude=location_data.latitude if location_data else None,
            longitude=location_data.longitude if location_data else None,
            display_name=location_data.display_name if location_data else None,
            timestamp=event.timestamp,
            status=event.status
        ))

    # Get origin and destination country info
    origin = CountryLocation(
        country_code=db_package.origin_country
    )
    destination = CountryLocation(
        country_code=db_package.destination_country
    )

    return PackageLocationsResponse(
        locations=locations,
        origin=origin,
        destination=destination
    )
