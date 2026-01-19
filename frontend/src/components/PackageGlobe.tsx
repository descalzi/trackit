import React, { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import { Box, CircularProgress, Typography, useTheme, alpha } from '@mui/material';
import { apiClient } from '../api/client';
import { GeocodedLocation, PackageStatus } from '../types';

interface PackageGlobeProps {
  packageId: string;
}

interface GlobePoint extends GeocodedLocation {
  size?: number;
  color?: string;
}

interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color?: string;
  altitude?: number;
  stroke?: number;
}

/**
 * Calculate great circle distance between two points in degrees
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c * 180 / Math.PI; // Return distance in degrees
};

/**
 * Calculate arc altitude based on distance
 * Longer distances need higher arcs to stay above globe surface
 */
const calculateArcAltitude = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);

  // Use very low altitude for short distances (city-level movements)
  // Scale exponentially so short distances stay close to surface
  if (distance < 1) {
    // Within ~111km: very low arc (0.005 to 0.02)
    return 0.005 + distance * 0.015;
  } else if (distance < 10) {
    // Regional travel ~111km to ~1,110km: low to medium arc (0.02 to 0.1)
    return 0.02 + ((distance - 1) / 9) * 0.08;
  } else {
    // Long distance travel: higher arc (0.1 to 0.5)
    return Math.min(0.5, 0.1 + ((distance - 10) / 170) * 0.4);
  }
};

/**
 * Calculate arc stroke width based on distance
 * Short distances need thinner lines, long distances can be thicker
 */
const calculateArcStroke = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);

  if (distance < 1) {
    // City-level: very thin (0.15 to 0.25)
    return 0.10 + distance * 0.1;
  } else if (distance < 10) {
    // Regional: thin to medium (0.25 to 0.5)
    return 0.15 + ((distance - 1) / 9) * 0.25;
  } else {
    // Long distance: medium to thick (0.5 to 0.8)
    return Math.min(0.7, 0.5 + ((distance - 10) / 170) * 0.3);
  }
};

/**
 * PackageGlobe component - 3D globe visualization of package journey
 */
const PackageGlobe: React.FC<PackageGlobeProps> = ({ packageId }) => {
  const globeRef = useRef<HTMLDivElement>(null);
  const globeInstance = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<GlobePoint[]>([]);
  const [arcs, setArcs] = useState<GlobeArc[]>([]);
  const theme = useTheme();

  // Get color based on package status
  const getStatusColor = (status: PackageStatus): string => {
    switch (status) {
      case PackageStatus.DELIVERED:
        return theme.palette.success.main;
      case PackageStatus.OUT_FOR_DELIVERY:
        return theme.palette.info.main;
      case PackageStatus.IN_TRANSIT:
        return theme.palette.primary.main;
      case PackageStatus.EXCEPTION:
        return theme.palette.error.main;
      case PackageStatus.PENDING:
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  // Load locations data
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.tracking.getLocations(packageId);

        // Filter locations that have lat/lon
        const validLocations = response.locations.filter(
          (loc) => loc.latitude !== null && loc.longitude !== null
        ) as GlobePoint[];

        // Add color and size to each point
        const enrichedLocations = validLocations.map((loc) => ({
          ...loc,
          color: getStatusColor(loc.status),
          size: 0.5,
        }));

        setLocations(enrichedLocations);

        // Create arcs between consecutive locations
        const newArcs: GlobeArc[] = [];
        for (let i = 0; i < enrichedLocations.length - 1; i++) {
          const start = enrichedLocations[i];
          const end = enrichedLocations[i + 1];

          if (start.latitude && start.longitude && end.latitude && end.longitude) {
            newArcs.push({
              startLat: start.latitude,
              startLng: start.longitude,
              endLat: end.latitude,
              endLng: end.longitude,
              color: alpha(theme.palette.primary.main, 0.8),
              altitude: calculateArcAltitude(start.latitude, start.longitude, end.latitude, end.longitude),
              stroke: calculateArcStroke(start.latitude, start.longitude, end.latitude, end.longitude),
            });
          }
        }

        setArcs(newArcs);
      } catch (err) {
        console.error('Failed to load locations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    };

    loadLocations();
  }, [packageId, theme]);

  // Initialize globe
  useEffect(() => {
    if (!globeRef.current || loading || error || locations.length === 0) {
      return;
    }

    // Clean up previous instance
    if (globeInstance.current) {
      globeInstance.current._destructor();
    }

    // Create new globe instance
    const globe = new Globe(globeRef.current)
      // Use tile-based rendering from OpenStreetMap for progressive detail loading
      // This provides high resolution when zoomed in, perfect for city-level detail
      .globeTileEngineUrl((x: number, y: number, l: number) =>
        `https://tile.openstreetmap.org/${l}/${x}/${y}.png`
      )
      .backgroundColor(theme.palette.mode === 'dark' ? '#0a0a0a' : '#ffffff')
      .width(globeRef.current.clientWidth)
      .height(500)
      // Location markers - show pins at each location
      .pointsData(locations)
      .pointLat('latitude')
      .pointLng('longitude')
      .pointColor((d: any) => d.color)
      .pointAltitude(0.01)
      .pointRadius(0.3)
      .pointLabel((d: any) => {
        const loc = d as GlobePoint;
        return `
          <div style="
            background: ${alpha(theme.palette.background.paper, 0.95)};
            padding: 8px 12px;
            border-radius: 4px;
            color: ${theme.palette.text.primary};
            font-family: ${theme.typography.fontFamily};
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            max-width: 250px;
          ">
            <strong>${loc.location_string || 'Unknown'}</strong><br/>
            <span style="color: ${theme.palette.text.secondary};">
              ${loc.status}<br/>
              ${new Date(loc.timestamp).toLocaleString()}
            </span>
            ${loc.display_name ? `<br/><small>${loc.display_name}</small>` : ''}
          </div>
        `;
      })
      // Arcs - show package journey between locations
      .arcsData(arcs)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor((d: any) => d.color)
      // .arcDashLength(0.4)
      // .arcDashGap(0.2)
      .arcStroke((d: any) => d.stroke || 0.5)
      .arcAltitude((d: any) => d.altitude || 0.1)
      // Controls
      .enablePointerInteraction(true);

    // Disable auto-rotate - keep globe still
    globe.controls().autoRotate = false;

    // Initial view - focus on last known location (most recent)
    if (locations.length > 0) {
      const lastLoc = locations[locations.length - 1];
      if (lastLoc.latitude && lastLoc.longitude) {
        globe.pointOfView({
          lat: lastLoc.latitude,
          lng: lastLoc.longitude,
          altitude: 0.8,
        }, 1000);
      }
    }

    globeInstance.current = globe;

    // Handle resize
    const handleResize = () => {
      if (globeRef.current && globeInstance.current) {
        globeInstance.current
          .width(globeRef.current.clientWidth)
          .height(500);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (globeInstance.current) {
        globeInstance.current._destructor();
      }
    };
  }, [locations, arcs, loading, error, theme]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 500,
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          borderRadius: 2,
          mb: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 500,
          bgcolor: alpha(theme.palette.error.light, 0.1),
          borderRadius: 2,
          mb: 4,
        }}
      >
        <Typography color="error">Failed to load globe: {error}</Typography>
      </Box>
    );
  }

  if (locations.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: 500,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 4,
        bgcolor: theme.palette.mode === 'dark' ? '#0a0a0a' : '#ffffff',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      <div ref={globeRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default PackageGlobe;
