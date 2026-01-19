import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Courier } from '../types';

interface CourierContextType {
  couriers: Courier[];
  getCourierByCode: (code: string) => Courier | undefined;
  loading: boolean;
}

const CourierContext = createContext<CourierContextType | undefined>(undefined);

export const CourierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCouriers = async () => {
      try {
        const response = await apiClient.tracking.getCouriers();
        setCouriers(response.couriers);
      } catch (error) {
        console.error('Failed to load couriers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCouriers();
  }, []);

  const getCourierByCode = (code: string): Courier | undefined => {
    return couriers.find(c => c.courierCode === code);
  };

  return (
    <CourierContext.Provider value={{ couriers, getCourierByCode, loading }}>
      {children}
    </CourierContext.Provider>
  );
};

export const useCouriers = (): CourierContextType => {
  const context = useContext(CourierContext);
  if (!context) {
    throw new Error('useCouriers must be used within a CourierProvider');
  }
  return context;
};
