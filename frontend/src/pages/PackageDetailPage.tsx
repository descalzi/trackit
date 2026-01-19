import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  LocalShipping,
  Error as ErrorIcon,
  AccessTime,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { useTracking } from '../hooks/useTracking';
import { useCouriers } from '../contexts/CourierContext';
import TrackingTimeline from '../components/TrackingTimeline';
import ConfirmDialog from '../components/ConfirmDialog';
import { Package, TrackingEvent, PackageStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { getFaviconUrl } from '../utils/favicon';
import refreshImage from '../assets/refresh.png';
import editImage from '../assets/edit.png';
import archiveImage from '../assets/archive.png';
import deleteImage from '../assets/delete.png';

const getStatusColor = (status?: PackageStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
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

const getStatusIcon = (status?: PackageStatus) => {
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
      return <AccessTime />;
  }
};

const PackageDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refresh: refreshTracking, loading: trackingLoading } = useTracking();
  const { getCourierByCode } = useCouriers();

  const [packageData, setPackageData] = useState<Package | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [note, setNote] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmColor?: 'primary' | 'error' | 'warning';
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadPackage = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const [pkgData, eventsData] = await Promise.all([
        apiClient.packages.getById(id),
        apiClient.packages.getEvents(id),
      ]);
      setPackageData(pkgData);
      setEvents(eventsData);
      setNote(pkgData.note || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackage();
  }, [id]);

  const handleRefresh = async () => {
    if (!id) return;
    const updated = await refreshTracking(id);
    if (updated) {
      await loadPackage();
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    try {
      await apiClient.packages.update(id, { note });
      setEditDialogOpen(false);
      await loadPackage();
    } catch (err) {
      console.error('Failed to update package:', err);
    }
  };

  const handleArchive = () => {
    if (!id || !packageData) return;
    setConfirmDialog({
      open: true,
      title: 'Archive Package',
      message: `Archive package ${packageData.note || packageData.tracking_number}?`,
      confirmColor: 'primary',
      onConfirm: async () => {
        await apiClient.packages.update(id, { archived: true });
        navigate('/');
      },
    });
  };

  const handleDelete = () => {
    if (!id || !packageData) return;
    setConfirmDialog({
      open: true,
      title: 'Delete Package',
      message: `Delete package ${packageData.note || packageData.tracking_number}? This cannot be undone.`,
      confirmColor: 'error',
      onConfirm: async () => {
        await apiClient.packages.delete(id);
        navigate('/');
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !packageData) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Package not found'}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Back to Dashboard
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
              {packageData.note || packageData.tracking_number}
            </Typography>
            {packageData.note && (
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Tracking: {packageData.tracking_number}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setEditDialogOpen(true)}>
              <img src={editImage} alt="Edit" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
            </IconButton>
            <IconButton onClick={handleArchive}>
              <img src={archiveImage} alt="Archive" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
            </IconButton>
            <IconButton onClick={handleDelete}>
              <img src={deleteImage} alt="Delete" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          {packageData.last_status && (
            <Chip
              label={packageData.last_status}
              color={getStatusColor(packageData.last_status)}
              icon={getStatusIcon(packageData.last_status)}
            />
          )}
          {packageData.detected_courier && (() => {
            const courier = getCourierByCode(packageData.detected_courier);
            return (
              <Chip
                label={courier?.courierName || packageData.detected_courier}
                variant="outlined"
                avatar={
                  courier?.website ? (
                    <img
                      src={getFaviconUrl(courier.website, 16)}
                      alt=""
                      style={{ width: 16, height: 16 }}
                      onError={(e) => {
                        // Hide image on error
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : undefined
                }
              />
            );
          })()}
        </Box>

        {/* Country Route */}
        {(packageData.origin_country || packageData.destination_country) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {packageData.origin_country && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <img
                  src={`https://flagcdn.com/24x18/${packageData.origin_country.toLowerCase()}.png`}
                  srcSet={`https://flagcdn.com/48x36/${packageData.origin_country.toLowerCase()}.png 2x, https://flagcdn.com/72x54/${packageData.origin_country.toLowerCase()}.png 3x`}
                  width="24"
                  height="18"
                  alt={packageData.origin_country}
                  style={{ border: '1px solid #e0e0e0' }}
                />
                <Typography variant="body2" color="text.secondary">{packageData.origin_country}</Typography>
              </Box>
            )}
            {packageData.origin_country && packageData.destination_country && (
              <Typography variant="body2" color="text.secondary">→</Typography>
            )}
            {packageData.destination_country && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <img
                  src={`https://flagcdn.com/24x18/${packageData.destination_country.toLowerCase()}.png`}
                  srcSet={`https://flagcdn.com/48x36/${packageData.destination_country.toLowerCase()}.png 2x, https://flagcdn.com/72x54/${packageData.destination_country.toLowerCase()}.png 3x`}
                  width="24"
                  height="18"
                  alt={packageData.destination_country}
                  style={{ border: '1px solid #e0e0e0' }}
                />
                <Typography variant="body2" color="text.secondary">{packageData.destination_country}</Typography>
              </Box>
            )}
          </Box>
        )}

        {packageData.last_location && (
          <Typography variant="body1" sx={{ mb: 1 }}>
            📍 {packageData.last_location}
          </Typography>
        )}

        {packageData.estimated_delivery && (
          <Typography variant="body1" sx={{ mb: 1, color: 'primary.main', fontWeight: 500 }}>
            📦 Estimated delivery: {format(new Date(packageData.estimated_delivery), 'MMM dd, yyyy')}
          </Typography>
        )}

        {packageData.last_updated && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Last updated {formatDistanceToNow(new Date(packageData.last_updated), { addSuffix: true })}
          </Typography>
        )}

        <Button
          variant="contained"
          startIcon={trackingLoading ? <CircularProgress size={20} /> : <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
          onClick={handleRefresh}
          disabled={trackingLoading}
        >
          {trackingLoading ? 'Refreshing...' : 'Refresh Tracking'}
        </Button>
      </Paper>

      <Typography variant="h5" component="h2" fontWeight={600} gutterBottom>
        Tracking History
      </Typography>

      <TrackingTimeline events={events} loading={false} />

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Package</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Amazon Order #123"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmColor={confirmDialog.confirmColor}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />
    </Box>
  );
};

export default PackageDetailPage;
