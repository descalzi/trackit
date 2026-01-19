from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime
from app.database import get_db, DBPackage, DBUser, DBTrackingEvent, PackageStatus
from app.models import TrackingLookupRequest, TrackingLookupResponse, Package, TrackingEventData
from app.api.auth import get_current_user
from app.services.ship24_service import Ship24Service, Ship24Error, Ship24RateLimitError, Ship24NotFoundError
import uuid

router = APIRouter()

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
        for event_data in result["events"]:
            # Check if event already exists
            existing_event = db.query(DBTrackingEvent).filter(
                DBTrackingEvent.package_id == package_id,
                DBTrackingEvent.timestamp == event_data["timestamp"],
                DBTrackingEvent.description == event_data.get("description", "")
            ).first()

            if not existing_event:
                print(f"DEBUG: Saving new event: {event_data.get('description')} at {event_data['timestamp']}")
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
            else:
                print(f"DEBUG: Skipping duplicate event: {event_data.get('description')}")

        db.commit()
        db.refresh(db_package)

        return db_package

    except Ship24RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    except Ship24NotFoundError:
        raise HTTPException(status_code=404, detail="Tracking number not found.")
    except Ship24Error as e:
        raise HTTPException(status_code=500, detail=f"Tracking service error: {str(e)}")
