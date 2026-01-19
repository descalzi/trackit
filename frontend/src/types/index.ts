// User and Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
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

// Courier Type enum
export enum CourierType {
  EVRI = 'Evri',
  ROYAL_MAIL = 'Royal Mail',
  DPD = 'DPD',
  AUTO_DETECT = 'Auto Detect',
  OTHER = 'Other',
}

// Package types
export interface Package {
  id: string;
  user_id: string;
  tracking_number: string;
  courier?: CourierType;
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
  courier?: CourierType;
  note?: string;
}

export interface PackageUpdate {
  courier?: CourierType;
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
  created_at: string;
}

export interface TrackingEventData {
  status: PackageStatus;
  location?: string;
  timestamp: string;
  description?: string;
  courier_event_code?: string;
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
