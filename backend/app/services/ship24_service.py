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
                print(f"DEBUG: Ship24 response body: {response.text[:500]}")

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
                response = await client.get(endpoint, headers=self.headers)

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
        # Ship24 response structure may vary - this is a basic implementation
        # Adjust based on actual Ship24 API response format
        tracker = data.get("data", {}).get("tracker", data.get("tracker", {}))

        tracking_number = tracker.get("trackingNumber", "")
        courier = tracker.get("courierCode", "Unknown")
        tracker_id = tracker.get("trackerId", "")

        # Get shipment data
        shipment = tracker.get("shipment", {})
        status_milestone = shipment.get("statusMilestone", "")
        location = shipment.get("location", {}).get("address", "")

        # Parse events
        events = self._parse_events(shipment.get("events", []))

        # Get status
        status = self._normalize_status(status_milestone)

        # Estimated delivery
        estimated_delivery = None
        if shipment.get("estimatedDelivery"):
            try:
                estimated_delivery = datetime.fromisoformat(shipment["estimatedDelivery"].replace("Z", "+00:00"))
            except:
                pass

        return {
            "tracking_number": tracking_number,
            "courier": courier,
            "tracker_id": tracker_id,
            "status": status,
            "location": location,
            "events": events,
            "estimated_delivery": estimated_delivery
        }

    def _normalize_status(self, ship24_status: str) -> PackageStatus:
        """
        Convert Ship24 status to our PackageStatus enum

        Args:
            ship24_status: Status string from Ship24

        Returns:
            PackageStatus enum value
        """
        status_lower = ship24_status.lower()

        if "delivered" in status_lower:
            return PackageStatus.DELIVERED
        elif "out for delivery" in status_lower or "out_for_delivery" in status_lower:
            return PackageStatus.OUT_FOR_DELIVERY
        elif "in transit" in status_lower or "in_transit" in status_lower:
            return PackageStatus.IN_TRANSIT
        elif "exception" in status_lower or "failed" in status_lower or "returned" in status_lower:
            return PackageStatus.EXCEPTION
        elif "pending" in status_lower or "info received" in status_lower:
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

            location_data = event.get("location", {})
            location = location_data.get("address", "") if isinstance(location_data, dict) else str(location_data)

            events.append({
                "status": self._normalize_status(event.get("statusMilestone", "")),
                "location": location,
                "timestamp": timestamp,
                "description": event.get("statusDescription", event.get("description", "")),
                "courier_event_code": event.get("eventCode", "")
            })

        # Sort by timestamp (newest first)
        events.sort(key=lambda x: x["timestamp"], reverse=True)

        return events
