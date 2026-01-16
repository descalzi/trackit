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
  Edit,
  Archive,
  Delete,
  CheckCircle,
  LocalShipping,
  Error as ErrorIcon,
  AccessTime,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { useTracking } from '../hooks/useTracking';
import TrackingTimeline from '../components/TrackingTimeline';
import { Package, TrackingEvent, PackageStatus } from '../types';
import { formatDistanceToNow } from 'date-fns';
import refreshImage from '../assets/refresh.png';

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

  const [packageData, setPackageData] = useState<Package | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');

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
      setNickname(pkgData.nickname || '');
      setDescription(pkgData.description || '');
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
      await apiClient.packages.update(id, { nickname, description });
      setEditDialogOpen(false);
      await loadPackage();
    } catch (err) {
      console.error('Failed to update package:', err);
    }
  };

  const handleArchive = async () => {
    if (!id || !packageData) return;
    if (window.confirm(`Archive package ${packageData.nickname || packageData.tracking_number}?`)) {
      await apiClient.packages.update(id, { archived: true });
      navigate('/');
    }
  };

  const handleDelete = async () => {
    if (!id || !packageData) return;
    if (window.confirm(`Delete package ${packageData.nickname || packageData.tracking_number}? This cannot be undone.`)) {
      await apiClient.packages.delete(id);
      navigate('/');
    }
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
              {packageData.nickname || packageData.tracking_number}
            </Typography>
            {packageData.nickname && (
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Tracking: {packageData.tracking_number}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setEditDialogOpen(true)}>
              <Edit />
            </IconButton>
            <IconButton onClick={handleArchive}>
              <Archive />
            </IconButton>
            <IconButton onClick={handleDelete} color="error">
              <Delete />
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
          {packageData.courier && (
            <Chip label={packageData.courier} variant="outlined" />
          )}
        </Box>

        {packageData.last_location && (
          <Typography variant="body1" sx={{ mb: 1 }}>
            📍 {packageData.last_location}
          </Typography>
        )}

        {packageData.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {packageData.description}
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
              label="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PackageDetailPage;
