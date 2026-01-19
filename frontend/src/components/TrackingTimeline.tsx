import React from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import { Paper, Typography, Box, Chip } from '@mui/material';
import {
  LocalShipping,
  CheckCircle,
  Error as ErrorIcon,
  AccessTime,
  LocationOn,
} from '@mui/icons-material';
import { TrackingEvent, PackageStatus } from '../types';
import { format } from 'date-fns';
import { useCouriers } from '../contexts/CourierContext';
import { getFaviconUrl } from '../utils/favicon';

interface TrackingTimelineProps {
  events: TrackingEvent[];
  loading?: boolean;
}

const getStatusIcon = (status: PackageStatus) => {
  switch (status) {
    case PackageStatus.DELIVERED:
      return <CheckCircle />;
    case PackageStatus.OUT_FOR_DELIVERY:
      return <LocalShipping />;
    case PackageStatus.IN_TRANSIT:
      return <LocalShipping />;
    case PackageStatus.EXCEPTION:
      return <ErrorIcon />;
    case PackageStatus.PENDING:
      return <AccessTime />;
    default:
      return <LocationOn />;
  }
};

const getStatusColor = (status: PackageStatus): 'primary' | 'success' | 'error' | 'warning' | 'grey' => {
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
          Click "Refresh Tracking" to fetch the latest updates
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline position="right">
      {events.map((event, index) => {
        // Check if courier changed from previous event
        const prevEvent = index < events.length - 1 ? events[index + 1] : null;
        const courierChanged = prevEvent && event.courier_event_code !== prevEvent.courier_event_code;

        return (
        <TimelineItem key={event.id}>
          <TimelineSeparator>
            <TimelineDot color={getStatusColor(event.status)}>
              {getStatusIcon(event.status)}
            </TimelineDot>
            {index < events.length - 1 && <TimelineConnector />}
          </TimelineSeparator>

          <TimelineContent sx={{ py: 2 }}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Chip
                  label={event.status}
                  color={getStatusColor(event.status)}
                  size="small"
                />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(event.timestamp), 'MMM dd, yyyy')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(event.timestamp), 'HH:mm')}
                  </Typography>
                </Box>
              </Box>

              {event.description && (
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                  {event.description}
                </Typography>
              )}

              {event.location && (
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn fontSize="small" />
                  {event.location}
                </Typography>
              )}

              {event.courier_event_code && (() => {
                const courier = getCourierByCode(event.courier_event_code);
                return (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={courier?.courierName || event.courier_event_code}
                      size="small"
                      variant="outlined"
                      color={courierChanged ? 'primary' : 'default'}
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
                    {courierChanged && (
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                        Courier changed
                      </Typography>
                    )}
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
