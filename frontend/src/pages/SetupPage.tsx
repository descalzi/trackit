import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  TextField,
  Chip,
  FormControlLabel,
  Switch,
  Button,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ArrowBack,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { LocationAdmin } from '../types';
import refreshImage from '../assets/refresh.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(true);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState('');
  const [retryingLocation, setRetryingLocation] = useState<string | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.admin.getLocations(failedOnly);
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [failedOnly]);

  const handleEditStart = (location: LocationAdmin) => {
    setEditingLocation(location.location_string);
    setEditAlias(location.alias || '');
  };

  const handleEditCancel = () => {
    setEditingLocation(null);
    setEditAlias('');
  };

  const handleEditSave = async (locationString: string) => {
    try {
      await apiClient.admin.updateLocationAlias(locationString, {
        alias: editAlias.trim() || undefined,
      });
      setEditingLocation(null);
      setEditAlias('');
      // Refresh the list after a short delay to allow background geocoding to start
      setTimeout(fetchLocations, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alias');
    }
  };

  const handleRetry = async (locationString: string) => {
    setRetryingLocation(locationString);
    try {
      await apiClient.admin.retryGeocode(locationString);
      // Refresh the list after a short delay to allow background geocoding to complete
      setTimeout(fetchLocations, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry geocoding');
    } finally {
      setRetryingLocation(null);
    }
  };

  if (loading && locations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Non-admin users see a simple message
  if (!user?.is_admin) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Nothing to setup yet
          </Typography>
        </Paper>
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={600}>
          Locations Editor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={failedOnly}
                onChange={(e) => setFailedOnly(e.target.checked)}
              />
            }
            label="Failed Only"
          />
          <Button
            variant="outlined"
            startIcon={<img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />}
            onClick={fetchLocations}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {locations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {failedOnly ? 'No failed geocoding locations' : 'No locations found'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {failedOnly
              ? 'All locations have been successfully geocoded!'
              : 'Locations will appear here as packages are tracked.'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Location String</TableCell>
                <TableCell>Normalized</TableCell>
                <TableCell>Alias</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Coordinates</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location) => (
                <TableRow
                  key={location.location_string}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {location.location_string}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {location.normalized_location}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {editingLocation === location.location_string ? (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          size="small"
                          value={editAlias}
                          onChange={(e) => setEditAlias(e.target.value)}
                          placeholder="Enter alias..."
                          sx={{ width: 200 }}
                          autoFocus
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditSave(location.location_string)}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleEditCancel}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" color={location.alias ? 'text.primary' : 'text.secondary'}>
                          {location.alias || '—'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleEditStart(location)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {location.geocoding_failed ? (
                      <Chip
                        label="Failed"
                        color="error"
                        size="small"
                        icon={<ErrorIcon />}
                      />
                    ) : location.latitude && location.longitude ? (
                      <Chip
                        label="Success"
                        color="success"
                        size="small"
                        icon={<CheckCircle />}
                      />
                    ) : (
                      <Chip
                        label="Pending"
                        color="default"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {location.latitude && location.longitude ? (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={location.usage_count}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Retry geocoding">
                      <IconButton
                        size="small"
                        onClick={() => handleRetry(location.location_string)}
                        disabled={retryingLocation === location.location_string}
                      >
                        {retryingLocation === location.location_string ? (
                          <CircularProgress size={20} />
                        ) : (
                          <RefreshIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {loading && locations.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default SetupPage;
