import httpx
import os
from typing import Optional, Dict, List
from datetime import datetime
from app.database import PackageStatus


class Ship24Error(Exception):
    """Base exception for Ship24 errors"""
    pass


class Ship24RateLimitError(Ship24Error):
    """Raised when Ship24 rate limit is exceeded"""
    pass


class Ship24NotFoundError(Ship24Error):
    """Raised when tracking number is not found"""
    pass


class Ship24Service:
    """
    Abstraction layer for Ship24 API
    Makes it easy to swap providers in the future
    """

    def __init__(self):
        self.api_key = os.getenv("SHIP24_API_KEY")
        if not self.api_key:
            raise ValueError("SHIP24_API_KEY environment variable is required")

        self.base_url = "https://api.ship24.com"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def track_package(
        self,
        tracking_number: str,
        courier: Optional[str] = None
    ) -> Dict:
        """
        Track a package using Ship24 API
        POST /public/v1/trackers/track

        Args:
            tracking_number: The package tracking number
            courier: Optional courier slug (e.g., "evri", "royal-mail", "dpd-uk")

        Returns:
            dict with tracking data including status, events, tracker_id

        Raises:
            Ship24RateLimitError: If API rate limit is exceeded
            Ship24NotFoundError: If tracking number not found
            Ship24Error: For other API errors
        """
        endpoint = f"{self.base_url}/public/v1/trackers/track"

        payload = {
            "trackingNumber": tracking_number
        }

        if courier:
            payload["courierCode"] = courier

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                print(f"DEBUG: Ship24 request to {endpoint}")
                print(f"DEBUG: Payload: {payload}")

                response = await client.post(
                    endpoint,
                    json=payload,
                    headers=self.headers
                )

                print(f"DEBUG: Ship24 response status: {response.status_code}")
                print(f"DEBUG: Ship24 response body: {response.text}")

                if response.status_code == 429:
                    raise Ship24RateLimitError("Ship24 API rate limit exceeded")

                if response.status_code == 404:
                    raise Ship24NotFoundError(f"Tracking number {tracking_number} not found")

                if response.status_code not in (200, 201):
                    raise Ship24Error(f"Ship24 API error: {response.status_code} - {response.text}")

                data = response.json()
                return self._parse_tracking_response(data)

            except httpx.TimeoutException:
                raise Ship24Error("Ship24 API request timed out")
            except httpx.RequestError as e:
                raise Ship24Error(f"Ship24 API request failed: {str(e)}")

    async def get_couriers(self) -> List[Dict]:
        """
        Get list of all supported couriers from Ship24
        GET /public/v1/couriers

        Returns:
            List of courier dictionaries with courierCode, courierName, etc.

        Raises:
            Ship24Error: For API errors
        """
        endpoint = f"{self.base_url}/public/v1/couriers"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(endpoint, headers=self.headers)

                if response.status_code == 429:
                    raise Ship24RateLimitError("Ship24 API rate limit exceeded")

                if response.status_code != 200:
                    raise Ship24Error(f"Ship24 API error: {response.status_code} - {response.text}")

                data = response.json()
                return data.get("data", {}).get("couriers", [])

            except httpx.TimeoutException:
                raise Ship24Error("Ship24 API request timed out")
            except httpx.RequestError as e:
                raise Ship24Error(f"Ship24 API request failed: {str(e)}")

    async def get_tracker_results(self, tracker_id: str) -> Dict:
        """
        Get cached results from Ship24
        GET /public/v1/trackers/{tracker_id}/results

        Args:
            tracker_id: Ship24 tracker ID

        Returns:
            dict with tracking data

        Raises:
            Ship24Error: For API errors
        """
        endpoint = f"{self.base_url}/public/v1/trackers/{tracker_id}/results"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                print(f"DEBUG: Ship24 request to {endpoint}")
                response = await client.get(endpoint, headers=self.headers)

                print(f"DEBUG: Ship24 response status: {response.status_code}")
                print(f"DEBUG: Ship24 response body: {response.text}")

                if response.status_code == 429:
                    raise Ship24RateLimitError("Ship24 API rate limit exceeded")

                if response.status_code == 404:
                    raise Ship24NotFoundError(f"Tracker {tracker_id} not found")

                if response.status_code != 200:
                    raise Ship24Error(f"Ship24 API error: {response.status_code} - {response.text}")

                data = response.json()
                return self._parse_tracking_response(data)

            except httpx.TimeoutException:
                raise Ship24Error("Ship24 API request timed out")
            except httpx.RequestError as e:
                raise Ship24Error(f"Ship24 API request failed: {str(e)}")

    def _parse_tracking_response(self, data: Dict) -> Dict:
        """
        Parse Ship24 API response into standardized format

        Args:
            data: Raw Ship24 API response

        Returns:
            Standardized tracking data dict
        """
        # Ship24 response structure: data.trackings[0] for /track endpoint
        # or data.tracker for /results endpoint
        tracking_data = data.get("data", {})
        if "trackings" in tracking_data and tracking_data["trackings"]:
            tracker = tracking_data["trackings"][0].get("tracker", {})
        else:
            tracker = tracking_data.get("tracker", data.get("tracker", {}))

        tracking_number = tracker.get("trackingNumber", "")

        # Handle courierCode - it can be a string, array, or None
        courier_code = tracker.get("courierCode")
        if isinstance(courier_code, list) and courier_code:
            courier = courier_code[0]  # Take first courier if array
        elif isinstance(courier_code, str) and courier_code:
            courier = courier_code
        else:
            courier = None  # Will be filled from shipment.courier if available

        tracker_id = tracker.get("trackerId", "")

        # Get shipment data and events
        if "trackings" in tracking_data and tracking_data["trackings"]:
            tracking = tracking_data["trackings"][0]
            shipment = tracking.get("shipment", {})
            # Events are at tracking level, not inside shipment
            ship24_events = tracking.get("events", [])
        else:
            shipment = tracker.get("shipment", {})
            # For /results endpoint, events might be in shipment
            ship24_events = shipment.get("events", [])

        status_milestone = shipment.get("statusMilestone", "")

        # Try to get location from various possible fields
        location_obj = shipment.get("location", {})
        if isinstance(location_obj, dict):
            location = location_obj.get("address", "")
        else:
            location = str(location_obj) if location_obj else ""

        # Parse events
        print(f"DEBUG: Found {len(ship24_events)} raw events in Ship24 response")
        events = self._parse_events(ship24_events)

        # If courier not found in tracker, try getting from shipment or first event
        if not courier:
            courier = shipment.get("courier", {}).get("name") or shipment.get("courierCode")
        if not courier and ship24_events:
            # Try to get courier from the first event's courierCode
            first_event_courier = ship24_events[0].get("courierCode")
            if first_event_courier:
                courier = first_event_courier

        # Get status
        status = self._normalize_status(status_milestone)

        # Estimated delivery - check both locations
        estimated_delivery = None
        delivery_info = shipment.get("delivery", {})
        estimated_delivery_str = delivery_info.get("estimatedDeliveryDate") or delivery_info.get("courierEstimatedDeliveryDate")
        if estimated_delivery_str:
            try:
                estimated_delivery = datetime.fromisoformat(estimated_delivery_str.replace("Z", "+00:00"))
            except:
                pass

        # Extract country codes
        origin_country = shipment.get("originCountryCode")
        destination_country = shipment.get("destinationCountryCode")
        print(f"DEBUG: Extracted country codes - Origin: {origin_country}, Destination: {destination_country}")

        return {
            "tracking_number": tracking_number,
            "courier": courier,
            "tracker_id": tracker_id,
            "status": status,
            "location": location,
            "events": events,
            "estimated_delivery": estimated_delivery,
            "origin_country": origin_country,
            "destination_country": destination_country
        }

    def _normalize_status(self, ship24_status: str) -> PackageStatus:
        """
        Convert Ship24 status to our PackageStatus enum

        Args:
            ship24_status: Status string from Ship24

        Returns:
            PackageStatus enum value
        """
        if not ship24_status:
            return PackageStatus.UNKNOWN

        # Normalize: replace underscores with spaces and convert to lowercase
        status_normalized = ship24_status.replace("_", " ").lower()

        if "delivered" in status_normalized:
            return PackageStatus.DELIVERED
        elif "out for delivery" in status_normalized:
            return PackageStatus.OUT_FOR_DELIVERY
        elif "in transit" in status_normalized:
            return PackageStatus.IN_TRANSIT
        elif "exception" in status_normalized or "failed" in status_normalized or "returned" in status_normalized:
            return PackageStatus.EXCEPTION
        elif "pending" in status_normalized or "info received" in status_normalized:
            return PackageStatus.PENDING
        else:
            return PackageStatus.UNKNOWN

    def _parse_events(self, ship24_events: List[Dict]) -> List[Dict]:
        """
        Parse Ship24 events into our format

        Args:
            ship24_events: List of events from Ship24

        Returns:
            List of standardized event dicts
        """
        events = []

        for event in ship24_events:
            timestamp_str = event.get("datetime", event.get("timestamp", ""))
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            except:
                timestamp = datetime.now()

            location_data = event.get("location")
            if location_data and isinstance(location_data, dict):
                location = location_data.get("address", "")
            elif location_data:
                location = str(location_data)
            else:
                location = ""

            # Get courier code for this event (packages can be handed off between couriers)
            event_courier = event.get("courierCode", "")

            events.append({
                "status": self._normalize_status(event.get("statusMilestone", "")),
                "location": location,
                "timestamp": timestamp,
                "description": event.get("status", ""),  # Ship24 uses "status" field for description
                "courier_event_code": event.get("statusCode", ""),  # Ship24 uses "statusCode" field
                "courier_code": event_courier  # Actual courier handling this event
            })

        # Sort by timestamp (newest first)
        events.sort(key=lambda x: x["timestamp"], reverse=True)

        return events
