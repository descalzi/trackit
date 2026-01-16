import { useState, useEffect, useCallback } from 'react';
import { Package, PackageCreate, PackageUpdate } from '../types';
import { apiClient } from '../api/client';

export const usePackages = (archived: boolean = false) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.packages.getAll(archived);
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packages');
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const createPackage = async (packageData: PackageCreate): Promise<Package> => {
    const newPackage = await apiClient.packages.create(packageData);
    setPackages(prev => [newPackage, ...prev]);
    return newPackage;
  };

  const updatePackage = async (id: string, updates: PackageUpdate): Promise<Package> => {
    const updated = await apiClient.packages.update(id, updates);
    setPackages(prev => prev.map(pkg => pkg.id === id ? updated : pkg));
    return updated;
  };

  const deletePackage = async (id: string): Promise<void> => {
    await apiClient.packages.delete(id);
    setPackages(prev => prev.filter(pkg => pkg.id !== id));
  };

  const archivePackage = async (id: string): Promise<Package> => {
    return updatePackage(id, { archived: true });
  };

  const unarchivePackage = async (id: string): Promise<Package> => {
    return updatePackage(id, { archived: false });
  };

  return {
    packages,
    loading,
    error,
    refresh: fetchPackages,
    createPackage,
    updatePackage,
    deletePackage,
    archivePackage,
    unarchivePackage,
  };
};
