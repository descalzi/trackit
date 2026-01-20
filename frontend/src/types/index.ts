// User and Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface GoogleAuthRequest {
  token: string;
}

// Package Status enum
export enum PackageStatus {
  IN_TRANSIT = 'In Transit',
  OUT_FOR_DELIVERY = 'Out for Delivery',
  DELIVERED = 'Delivered',
  EXCEPTION = 'Exception',
  PENDING = 'Pending',
  UNKNOWN = 'Unknown',
}

// Package types
export interface Package {
  id: string;
  user_id: string;
  tracking_number: string;
  courier?: string;  // Courier code (e.g., "evri", "dhl")
  note?: string;
  ship24_tracker_id?: string;
  last_status?: PackageStatus;
  last_location?: string;
  last_updated?: string;
  delivered_at?: string;
  origin_country?: string;
  destination_country?: string;
  estimated_delivery?: string;
  detected_courier?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackageCreate {
  tracking_number: string;
  courier?: string;  // Courier code (e.g., "evri", "dhl")
  note?: string;
}

export interface PackageUpdate {
  courier?: string;  // Courier code (e.g., "evri", "dhl")
  note?: string;
  archived?: boolean;
}

// Tracking Event types
export interface TrackingEvent {
  id: string;
  package_id: string;
  status: PackageStatus;
  location?: string;
  timestamp: string;
  description?: string;
  courier_event_code?: string;
  courier_code?: string;
  created_at: string;
}

export interface TrackingEventData {
  status: PackageStatus;
  location?: string;
  timestamp: string;
  description?: string;
  courier_event_code?: string;
  courier_code?: string;
}

// Tracking lookup types
export interface TrackingLookupRequest {
  tracking_number: string;
  courier?: string;
}

export interface TrackingLookupResponse {
  tracking_number: string;
  status: PackageStatus;
  courier: string;
  events: TrackingEventData[];
  estimated_delivery?: string;
  ship24_tracker_id?: string;
}

// Courier types
export interface Courier {
  courierCode: string;
  courierName: string;
  website: string;
  isPost: boolean;
  countryCode: string | null;
  requiredFields: string[] | null;
  isDeprecated: boolean;
}

// Geocoding types
export interface GeocodedLocation {
  event_id: string;
  location_string?: string;
  latitude?: number;
  longitude?: number;
  display_name?: string;
  timestamp: string;
  status: PackageStatus;
}

export interface CountryLocation {
  country_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface PackageLocationsResponse {
  locations: GeocodedLocation[];
  origin: CountryLocation;
  destination: CountryLocation;
}

// Admin types
export interface LocationAdmin {
  location_string: string;
  normalized_location: string;
  alias?: string;
  latitude?: number;
  longitude?: number;
  display_name?: string;
  country_code?: string;
  geocoded_at?: string;
  geocoding_failed: boolean;
  usage_count: number;
}

export interface LocationAliasUpdate {
  alias?: string;
}
