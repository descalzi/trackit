import { useState } from 'react';
import { TrackingLookupRequest, TrackingLookupResponse, Package } from '../types';
import { apiClient } from '../api/client';

export const useTracking = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (request: TrackingLookupRequest): Promise<TrackingLookupResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.tracking.lookup(request);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to lookup tracking';
      setError(errorMessage);
      console.error('Error looking up tracking:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (packageId: string): Promise<Package | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.tracking.refresh(packageId);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh tracking';
      setError(errorMessage);
      console.error('Error refreshing tracking:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    lookup,
    refresh,
  };
};
