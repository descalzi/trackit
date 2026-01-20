import {
  AuthResponse,
  GoogleAuthRequest,
  User,
  Package,
  PackageCreate,
  PackageUpdate,
  TrackingEvent,
  TrackingLookupRequest,
  TrackingLookupResponse,
  Courier,
  PackageLocationsResponse,
  LocationAdmin,
  LocationAliasUpdate,
  DeliveryLocation,
  DeliveryLocationCreate,
  DeliveryLocationUpdate,
  GeocodeRequest,
  GeocodeResponse
} from '../types';
import { getAuthHeader } from '../utils/auth';

/**
 * Smart API URL detection following Barkly pattern
 */
const getApiUrl = (): string => {
  // 1. Use VITE_API_URL if set (production or explicit override)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. In production build, use empty string (same origin via Nginx proxy)
  if (import.meta.env.PROD) {
    return '';
  }

  const hostname = window.location.hostname;

  // 3. Tailscale: http://hostname:8006
  if (hostname.includes('ts.net')) {
    return `http://${hostname}:8006`;
  }

  // 4. Local IP: http://192.168.x.x:8006
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `http://${hostname}:8006`;
  }

  // 5. Default: http://localhost:8006
  return 'http://localhost:8006';
};

const API_URL = getApiUrl();
console.log('TrackIt API URL:', API_URL);

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || 'An error occurred');
    }

    // Handle 204 No Content responses (common for DELETE operations)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

/**
 * API client with all backend endpoints
 */
export const apiClient = {
  // Authentication endpoints
  auth: {
    /**
     * Authenticate with Google OAuth token
     */
    googleAuth: (token: string): Promise<AuthResponse> => {
      const request: GoogleAuthRequest = { token };
      return apiFetch<AuthResponse>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    /**
     * Get current user info
     */
    getMe: (): Promise<User> => {
      return apiFetch<User>('/api/auth/me', {
        headers: getAuthHeader(),
      });
    },
  },

  // Package endpoints
  packages: {
    /**
     * Get all packages for current user
     */
    getAll: (archived: boolean = false): Promise<Package[]> => {
      return apiFetch<Package[]>(`/api/packages?archived=${archived}`, {
        headers: getAuthHeader(),
      });
    },

    /**
     * Get package by ID
     */
    getById: (id: string): Promise<Package> => {
      return apiFetch<Package>(`/api/packages/${id}`, {
        headers: getAuthHeader(),
      });
    },

    /**
     * Create a new package
     */
    create: (pkg: PackageCreate): Promise<Package> => {
      return apiFetch<Package>('/api/packages', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(pkg),
      });
    },

    /**
     * Update package
     */
    update: (id: string, pkg: PackageUpdate): Promise<Package> => {
      return apiFetch<Package>(`/api/packages/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(pkg),
      });
    },

    /**
     * Delete package
     */
    delete: (id: string): Promise<void> => {
      return apiFetch<void>(`/api/packages/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
    },

    /**
     * Get tracking events for a package
     */
    getEvents: (id: string): Promise<TrackingEvent[]> => {
      return apiFetch<TrackingEvent[]>(`/api/packages/${id}/events`, {
        headers: getAuthHeader(),
      });
    },
  },

  // Tracking endpoints
  tracking: {
    /**
     * Look up tracking number without saving
     */
    lookup: (request: TrackingLookupRequest): Promise<TrackingLookupResponse> => {
      return apiFetch<TrackingLookupResponse>('/api/tracking/lookup', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(request),
      });
    },

    /**
     * Refresh tracking data for saved package
     */
    refresh: (packageId: string): Promise<Package> => {
      return apiFetch<Package>(`/api/tracking/refresh/${packageId}`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
    },

    /**
     * Get list of all supported couriers
     */
    getCouriers: (): Promise<{ couriers: Courier[] }> => {
      return apiFetch<{ couriers: Courier[] }>('/api/tracking/couriers');
    },

    /**
     * Get geocoded locations for a package
     */
    getLocations: (packageId: string): Promise<PackageLocationsResponse> => {
      return apiFetch<PackageLocationsResponse>(
        `/api/tracking/locations/${packageId}`,
        { headers: getAuthHeader() }
      );
    },
  },

  // Delivery Location endpoints
  deliveryLocations: {
    /**
     * Get all delivery locations for current user
     */
    getAll: (): Promise<DeliveryLocation[]> => {
      return apiFetch<DeliveryLocation[]>('/api/delivery-locations', {
        headers: getAuthHeader(),
      });
    },

    /**
     * Geocode an address before creating location
     */
    geocode: (request: GeocodeRequest): Promise<GeocodeResponse> => {
      return apiFetch<GeocodeResponse>('/api/delivery-locations/geocode', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(request),
      });
    },

    /**
     * Create a new delivery location
     */
    create: (location: DeliveryLocationCreate): Promise<DeliveryLocation> => {
      return apiFetch<DeliveryLocation>('/api/delivery-locations', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(location),
      });
    },

    /**
     * Update a delivery location
     */
    update: (id: string, location: DeliveryLocationUpdate): Promise<DeliveryLocation> => {
      return apiFetch<DeliveryLocation>(`/api/delivery-locations/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(location),
      });
    },

    /**
     * Delete a delivery location
     */
    delete: (id: string): Promise<{ success: boolean; message: string }> => {
      return apiFetch<{ success: boolean; message: string }>(
        `/api/delivery-locations/${id}`,
        {
          method: 'DELETE',
          headers: getAuthHeader(),
        }
      );
    },
  },

  // Admin endpoints
  admin: {
    /**
     * Get all locations with optional filter for failed geocoding
     */
    getLocations: (failedOnly: boolean = false): Promise<LocationAdmin[]> => {
      return apiFetch<LocationAdmin[]>(
        `/api/admin/locations?failed_only=${failedOnly}`,
        { headers: getAuthHeader() }
      );
    },

    /**
     * Update alias for a location
     */
    updateLocationAlias: (locationString: string, update: LocationAliasUpdate): Promise<{ success: boolean; message: string }> => {
      return apiFetch<{ success: boolean; message: string }>(
        `/api/admin/locations/${encodeURIComponent(locationString)}/alias`,
        {
          method: 'PUT',
          headers: getAuthHeader(),
          body: JSON.stringify(update),
        }
      );
    },

    /**
     * Retry geocoding for a location
     */
    retryGeocode: (locationString: string): Promise<{ success: boolean; message: string }> => {
      return apiFetch<{ success: boolean; message: string }>(
        `/api/admin/locations/${encodeURIComponent(locationString)}/retry`,
        {
          method: 'POST',
          headers: getAuthHeader(),
        }
      );
    },
  },
};
