import React from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import TimelineOppositeContent, {
  timelineOppositeContentClasses,
} from '@mui/lab/TimelineOppositeContent';

import { Paper, Typography, Box, Chip } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { TrackingEvent, PackageStatus } from '../types';
import { format } from 'date-fns';
import { useCouriers } from '../contexts/CourierContext';
import { getFaviconUrl } from '../utils/favicon';
import deliveredImage from '../assets/delivered.png';
import deliveryImage from '../assets/delivery.png';
import packageErrorImage from '../assets/package_error.png';
import pendingImage from '../assets/pending.png';
import customsImage from '../assets/customs.png';
import airplaneImage from '../assets/airplane.png';
import truckImage from '../assets/truck.png';
import packageImage from '../assets/package.png';

interface TrackingTimelineProps {
  events: TrackingEvent[];
  loading?: boolean;
}

const getStatusIcon = (status: PackageStatus, description?: string) => {
  const iconStyle = { height: '25px', width: '25px', objectFit: 'contain' as const };

  switch (status) {
    case PackageStatus.DELIVERED:
      return <img src={deliveredImage} alt="" style={iconStyle} />;
    case PackageStatus.OUT_FOR_DELIVERY:
      return <img src={deliveryImage} alt="" style={iconStyle} />;
    case PackageStatus.EXCEPTION:
      return <img src={packageErrorImage} alt="" style={iconStyle} />;
    case PackageStatus.PENDING:
      return <img src={pendingImage} alt="" style={iconStyle} />;
    case PackageStatus.IN_TRANSIT:
      if (description) {
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes('customs') || lowerDesc.includes('import') || lowerDesc.includes('export')) {
          return <img src={customsImage} alt="" style={iconStyle} />;
        }
        if (lowerDesc.includes('airport') || lowerDesc.includes('flight') || lowerDesc.includes('country')) {
          return <img src={airplaneImage} alt="" style={iconStyle} />;
        }
      }
      return <img src={truckImage} alt="" style={iconStyle} />;
    default:
      return <img src={packageImage} alt="" style={iconStyle} />;
  }
};

const getStatusColorForDot = (status: PackageStatus): 'primary' | 'success' | 'error' | 'warning' | 'grey' => {
  switch (status) {
    case PackageStatus.DELIVERED:
      return 'success';
    case PackageStatus.OUT_FOR_DELIVERY:
      return 'primary';
    case PackageStatus.IN_TRANSIT:
      return 'primary';
    case PackageStatus.EXCEPTION:
      return 'error';
    case PackageStatus.PENDING:
      return 'warning';
    default:
      return 'grey';
  }
};

const getStatusColorForChip = (status: PackageStatus): 'primary' | 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case PackageStatus.DELIVERED:
      return 'success';
    case PackageStatus.OUT_FOR_DELIVERY:
      return 'primary';
    case PackageStatus.IN_TRANSIT:
      return 'primary';
    case PackageStatus.EXCEPTION:
      return 'error';
    case PackageStatus.PENDING:
      return 'warning';
    default:
      return 'default';
  }
};

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ events, loading = false }) => {
  const { getCourierByCode } = useCouriers();

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Loading tracking events...
        </Typography>
      </Box>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No tracking events yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          "Refresh Tracking" to fetch the latest updates
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline position="right" sx={{ [`& .${timelineOppositeContentClasses.root}`]: { flex: 0.2 }, }}>
      {events.map((event, index) => {
        return (
        <TimelineItem key={event.id}>
          <TimelineOppositeContent>
              <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    {/* @ts-expect-error date-fns v3 type issue */}
                    {format(new Date(event.timestamp), 'MMM dd, yyyy')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {/* @ts-expect-error date-fns v3 type issue */}
                    {format(new Date(event.timestamp), 'HH:mm')}
                  </Typography>
                </Box>
          </TimelineOppositeContent>

          <TimelineSeparator>
            <TimelineDot color={getStatusColorForDot(event.status)} variant="outlined" sx={{p:1}}>
              {getStatusIcon(event.status, event.description)}
            </TimelineDot>
            {index < events.length - 1 && <TimelineConnector />}
          </TimelineSeparator>

          <TimelineContent >
            <Paper elevation={2} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex',  alignItems: 'center', mb: 1, gap:2 }}>
                <Chip
                  label={event.status}
                  color={getStatusColorForChip(event.status)}
                  size="small"
                />
                {event.location && (
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn fontSize="small" />
                  {event.location}
                </Typography>
              )}
              </Box>

              {event.description && (
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                  {event.description}
                </Typography>
              )}

              {event.courier_code && (() => {
                const courier = getCourierByCode(event.courier_code);
                return (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={courier?.courierName || event.courier_code}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                      avatar={
                        courier?.website ? (
                          <img
                            src={getFaviconUrl(courier.website, 16)}
                            alt=""
                            style={{ width: 12, height: 12 }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : undefined
                      }
                    />
                  </Box>
                );
              })()}
            </Paper>
          </TimelineContent>
        </TimelineItem>
        );
      })}
    </Timeline>
  );
};

export default TrackingTimeline;
