-- Clean up string "null" values in tracking_events table
UPDATE tracking_events 
SET location_id = NULL 
WHERE location_id = 'null';

UPDATE tracking_events 
SET location = NULL 
WHERE location = 'null';

-- Clean up packages with null last_location that should have delivery location
-- This will be handled by the next refresh, but we can fix manually if needed
