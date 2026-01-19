"""Geocoding service using Nominatim (OpenStreetMap) API."""

import asyncio
import re
from datetime import datetime
from typing import Optional, Dict, Any
import httpx
from sqlalchemy.orm import Session

from app.database import DBLocation, DBTrackingEvent


class GeocodingService:
    """Service for geocoding locations using Nominatim."""

    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    USER_AGENT = "TrackIt Package Tracker"
    RATE_LIMIT_DELAY = 1.0  # Nominatim requires max 1 request per second

    def __init__(self):
        self._last_request_time = 0.0

    @staticmethod
    def normalize_location(location: str) -> str:
        """
        Normalize location string by removing distribution center codes and extra whitespace.

        Examples:
            "East Grinstead DO" -> "East Grinstead"
            "LOS ANGELES CA INTERNATIONAL DISTRIBUTION CENTER" -> "LOS ANGELES CA"
            "New York, NY  " -> "New York, NY"
        """
        if not location:
            return ""

        # Remove common distribution center suffixes
        location = re.sub(r'\s+(DO|DC|MC|DISTRIBUTION CENTER|INTERNATIONAL DISTRIBUTION CENTER)$',
                         '', location, flags=re.IGNORECASE)

        # Normalize whitespace
        location = ' '.join(location.split())

        return location.strip()

    async def _respect_rate_limit(self) -> None:
        """Ensure we don't exceed Nominatim's rate limit (1 req/sec)."""
        current_time = asyncio.get_event_loop().time()
        time_since_last_request = current_time - self._last_request_time

        if time_since_last_request < self.RATE_LIMIT_DELAY:
            await asyncio.sleep(self.RATE_LIMIT_DELAY - time_since_last_request)

        self._last_request_time = asyncio.get_event_loop().time()

    async def geocode_location(self, location_string: str) -> Optional[Dict[str, Any]]:
        """
        Geocode a location string using Nominatim API.

        Args:
            location_string: The location to geocode

        Returns:
            Dictionary with geocoding results or None if geocoding failed:
            {
                'latitude': float,
                'longitude': float,
                'display_name': str,
                'country_code': str
            }
        """
        if not location_string:
            return None

        normalized = self.normalize_location(location_string)
        if not normalized:
            return None

        # Respect rate limit
        await self._respect_rate_limit()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.NOMINATIM_URL,
                    params={
                        'q': normalized,
                        'format': 'json',
                        'limit': 1,
                        'addressdetails': 1
                    },
                    headers={
                        'User-Agent': self.USER_AGENT
                    },
                    timeout=10.0
                )

                if response.status_code != 200:
                    return None

                results = response.json()
                if not results or len(results) == 0:
                    return None

                result = results[0]
                return {
                    'latitude': float(result['lat']),
                    'longitude': float(result['lon']),
                    'display_name': result.get('display_name', ''),
                    'country_code': result.get('address', {}).get('country_code', '').upper()
                }

        except Exception as e:
            # Log error but don't crash
            print(f"Geocoding error for '{location_string}': {e}")
            return None

    async def geocode_and_cache(self, location_string: str, db: Session) -> Optional[DBLocation]:
        """
        Geocode a location and cache it in the database.
        Uses alias if present, otherwise uses normalized location.

        Args:
            location_string: The location string to geocode
            db: Database session

        Returns:
            DBLocation object or None
        """
        if not location_string:
            return None

        # Check if already cached
        cached = db.query(DBLocation).filter(
            DBLocation.location_string == location_string
        ).first()

        if cached:
            # If geocoding was already attempted (successful or failed) and no alias change, return cached result
            if (cached.geocoded_at or cached.geocoding_failed) and not (cached.alias and not cached.geocoded_at):
                return cached

        # Determine what to geocode: alias (if present) or normalized location
        if cached and cached.alias:
            search_term = cached.alias
            print(f"Using alias '{search_term}' for location '{location_string}'")
        else:
            search_term = self.normalize_location(location_string)

        # Geocode the location
        result = await self.geocode_location(search_term)

        normalized = self.normalize_location(location_string)

        if result:
            # Update or create location with geocoded data
            if cached:
                cached.normalized_location = normalized
                cached.latitude = result['latitude']
                cached.longitude = result['longitude']
                cached.display_name = result['display_name']
                cached.country_code = result['country_code']
                cached.geocoded_at = datetime.now()
                cached.geocoding_failed = False
            else:
                cached = DBLocation(
                    location_string=location_string,
                    normalized_location=normalized,
                    latitude=result['latitude'],
                    longitude=result['longitude'],
                    display_name=result['display_name'],
                    country_code=result['country_code'],
                    geocoded_at=datetime.now(),
                    geocoding_failed=False
                )
                db.add(cached)
        else:
            # Mark as failed
            if cached:
                cached.geocoding_failed = True
                cached.normalized_location = normalized
            else:
                cached = DBLocation(
                    location_string=location_string,
                    normalized_location=normalized,
                    geocoding_failed=True
                )
                db.add(cached)

        db.commit()
        db.refresh(cached)
        return cached

    async def batch_geocode_package_events(self, package_id: str, db: Session) -> int:
        """
        Geocode all events for a package that don't have geocoded locations yet.

        Args:
            package_id: The package ID
            db: Database session

        Returns:
            Number of locations geocoded
        """
        # Get all events for this package
        events = db.query(DBTrackingEvent).filter(
            DBTrackingEvent.package_id == package_id,
            DBTrackingEvent.location.isnot(None),
            DBTrackingEvent.location != ''
        ).all()

        print(f"Found {len(events)} events with locations for package {package_id}")

        # Get unique locations that need geocoding
        locations_to_geocode = set()
        for event in events:
            if not event.location_id:
                locations_to_geocode.add(event.location)
            else:
                # Check if the location has been geocoded
                loc = db.query(DBLocation).filter(
                    DBLocation.location_string == event.location
                ).first()
                if loc and not loc.geocoded_at and not loc.geocoding_failed:
                    locations_to_geocode.add(event.location)

        print(f"Need to geocode {len(locations_to_geocode)} unique locations: {locations_to_geocode}")

        geocoded_count = 0
        for location_string in locations_to_geocode:
            print(f"Geocoding: {location_string}")
            result = await self.geocode_and_cache(location_string, db)
            if result and result.geocoded_at:
                geocoded_count += 1
                print(f"  ✓ Success: {result.latitude}, {result.longitude}")
            elif result and result.geocoding_failed:
                print(f"  ✗ Failed to geocode")
            else:
                print(f"  ? Unknown result")

            # Update event's location_id if not already set
            events_to_update = db.query(DBTrackingEvent).filter(
                DBTrackingEvent.package_id == package_id,
                DBTrackingEvent.location == location_string,
                DBTrackingEvent.location_id.is_(None)
            ).all()

            for event in events_to_update:
                event.location_id = location_string

        db.commit()
        print(f"Geocoded {geocoded_count}/{len(locations_to_geocode)} locations successfully")
        return geocoded_count


    async def geocode_all_pending(self, db: Session) -> int:
        """
        Geocode all locations that haven't been geocoded yet.

        Args:
            db: Database session

        Returns:
            Number of locations geocoded
        """
        # Find all locations that need geocoding
        pending_locations = db.query(DBLocation).filter(
            DBLocation.geocoded_at.is_(None),
            DBLocation.geocoding_failed == False
        ).all()

        if not pending_locations:
            print("No pending locations to geocode")
            return 0

        print(f"Found {len(pending_locations)} locations to geocode")

        geocoded_count = 0
        for location in pending_locations:
            print(f"Geocoding: {location.location_string}")
            result = await self.geocode_location(location.location_string)

            if result:
                location.latitude = result['latitude']
                location.longitude = result['longitude']
                location.display_name = result['display_name']
                location.country_code = result['country_code']
                location.geocoded_at = datetime.now()
                location.geocoding_failed = False
                geocoded_count += 1
                print(f"  ✓ Success: {result['latitude']}, {result['longitude']}")
            else:
                location.geocoding_failed = True
                print(f"  ✗ Failed to geocode")

            db.commit()

        print(f"Geocoded {geocoded_count}/{len(pending_locations)} locations successfully")
        return geocoded_count


# Singleton instance
_geocoding_service: Optional[GeocodingService] = None


def get_geocoding_service() -> GeocodingService:
    """Get or create the geocoding service singleton."""
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService()
    return _geocoding_service
