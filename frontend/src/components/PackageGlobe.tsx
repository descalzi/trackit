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

interface GlobePath {
  coords: Array<[number, number]>; // Array of [lat, lng] pairs
  color?: string;
  stroke?: number;
  label?: string;
}

/**
 * PackageGlobe component - 3D globe visualization of package journey
 */
const PackageGlobe: React.FC<PackageGlobeProps> = ({ packageId }) => {
  const globeRef = useRef<HTMLDivElement>(null);
  const globeInstance = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<GlobePoint[]>([]);
  const [paths, setPaths] = useState<GlobePath[]>([]);
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

        // Create paths between consecutive locations
        const newPaths: GlobePath[] = [];
        for (let i = 0; i < enrichedLocations.length - 1; i++) {
          const start = enrichedLocations[i];
          const end = enrichedLocations[i + 1];

          if (start.latitude && start.longitude && end.latitude && end.longitude) {
            // Create label showing start -> end location
            const startName = start.location_string || 'Unknown';
            const endName = end.location_string || 'Unknown';
            const label = `${startName} → ${endName}`;

            newPaths.push({
              coords: [
                [start.latitude, start.longitude],
                [end.latitude, end.longitude]
              ],
              color: alpha(theme.palette.primary.main, 0.8),
              stroke: 8,
              label: label
            });
          }
        }

        setPaths(newPaths);
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
      // .bumpImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
      .backgroundColor(theme.palette.mode === 'dark' ? '#0a0a0a' : '#ffffff')
      .width(globeRef.current.clientWidth)
      .height(500)
      // Location markers - only show pins when there's exactly one location
      // For multiple locations, the arcs will show the journey
      // .pointsData(locations.length === 1 ? locations : [])
      // .pointLat('latitude')
      // .pointLng('longitude')
      // .pointColor((d: any) => d.color)
      // .pointAltitude(0.01)
      // .pointRadius(0.3)
      // Paths - show package journey between locations
      .pathsData(paths)
      .pathPoints('coords')
      .pathPointLat((p: any) => p[0])
      .pathPointLng((p: any) => p[1])
      .pathColor((d: any) => d.color)
      .pathStroke((d: any) => d.stroke || 8)
      .pathLabel((d: any) => d.label || '')
      // .pathDashLength(0.9)
      // .pathDashGap(0.1)
      // .pathDashAnimateTime(20000)
      // Controls
      // .enablePointerInteraction(true);

    // Disable auto-rotate - keep globe still
    globe.controls().autoRotate = false;

    // Initial view - focus on last known location (most recent)
    if (locations.length > 0) {
      const lastLoc = locations[locations.length - 1];
      if (lastLoc.latitude && lastLoc.longitude) {
        globe.pointOfView({
          lat: lastLoc.latitude,
          lng: lastLoc.longitude,
          altitude: 0.2
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
  }, [locations, paths, loading, error, theme]);

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
