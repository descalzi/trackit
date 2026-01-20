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
  TextField,
  Chip,
  FormControlLabel,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ArrowBack,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { apiClient } from '../api/client';
import { LocationAdmin, DeliveryLocation } from '../types';
import refreshImage from '../assets/refresh.png';
import editImage from '../assets/edit.png';
import deleteImage from '../assets/delete.png';
import mapImage from '../assets/map.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Admin locations state
  const [locations, setLocations] = useState<LocationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(true);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState('');
  const [retryingLocation, setRetryingLocation] = useState<string | null>(null);

  // Delivery locations state
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDeliveryLocation, setEditingDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deliveryMenuAnchor, setDeliveryMenuAnchor] = useState<{ element: HTMLElement; locationId: string } | null>(null);
  const [locationsMenuAnchor, setLocationsMenuAnchor] = useState<{ element: HTMLElement; locationString: string } | null>(null);

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

  const fetchDeliveryLocations = async () => {
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const data = await apiClient.deliveryLocations.getAll();
      setDeliveryLocations(data);
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : 'Failed to fetch delivery locations');
    } finally {
      setDeliveryLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchDeliveryLocations();
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

  // Delivery location handlers
  const handleOpenAddDialog = () => {
    setEditingDeliveryLocation(null);
    setNewLocationName('');
    setNewLocationAddress('');
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (location: DeliveryLocation) => {
    setEditingDeliveryLocation(location);
    setNewLocationName(location.name);
    setNewLocationAddress(location.address);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingDeliveryLocation(null);
    setNewLocationName('');
    setNewLocationAddress('');
    setDeliveryError(null);
  };

  const handleGeocodeAndSave = async () => {
    if (!newLocationName.trim() || !newLocationAddress.trim()) {
      setDeliveryError('Name and address are required');
      return;
    }

    setGeocoding(true);
    setDeliveryError(null);

    try {
      // First geocode the address to validate it
      await apiClient.deliveryLocations.geocode({ address: newLocationAddress });

      // If geocoding succeeds, save the location
      setSaving(true);
      if (editingDeliveryLocation) {
        await apiClient.deliveryLocations.update(editingDeliveryLocation.id, {
          name: newLocationName.trim(),
          address: newLocationAddress.trim(),
        });
      } else {
        await apiClient.deliveryLocations.create({
          name: newLocationName.trim(),
          address: newLocationAddress.trim(),
        });
      }

      await fetchDeliveryLocations();
      handleCloseDialog();
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setGeocoding(false);
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this delivery location?')) {
      return;
    }

    setDeleting(id);
    try {
      await apiClient.deliveryLocations.delete(id);
      await fetchDeliveryLocations();
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : 'Failed to delete location');
    } finally {
      setDeleting(null);
    }
  };

  if ((loading || deliveryLoading) && locations.length === 0 && deliveryLocations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
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

      {/* Delivery Locations Section - visible to all users */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Delivery Locations
          </Typography>
          <Button
            variant="contained"
            onClick={handleOpenAddDialog}
          >
            Add Location
          </Button>
        </Box>

        {deliveryError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setDeliveryError(null)}>
            {deliveryError}
          </Alert>
        )}

        {deliveryLocations.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No delivery locations yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a delivery location (like "Home" or "Office") to track where your packages are delivered on the map.
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Coordinates</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliveryLocations.map((location) => (
                  <TableRow
                    key={location.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Typography variant="body1" fontWeight={500}>
                        {location.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {location.display_name || location.address}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeliveryMenuAnchor({ element: e.currentTarget, locationId: location.id });
                        }}
                        disabled={deleting === location.id}
                      >
                        {deleting === location.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <MoreVertIcon />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Delivery Location Actions Menu */}
        <Menu
          anchorEl={deliveryMenuAnchor?.element}
          open={Boolean(deliveryMenuAnchor)}
          onClose={() => setDeliveryMenuAnchor(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {deliveryMenuAnchor && (() => {
            const location = deliveryLocations.find(l => l.id === deliveryMenuAnchor.locationId);
            if (!location) return null;

            return [
              <MenuItem key="view-map" onClick={() => {
                window.open(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`, '_blank');
                setDeliveryMenuAnchor(null);
              }}>
                <ListItemIcon>
                  <img src={mapImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                </ListItemIcon>
                <ListItemText>View in Map</ListItemText>
              </MenuItem>,
              <MenuItem key="edit" onClick={() => {
                handleOpenEditDialog(location);
                setDeliveryMenuAnchor(null);
              }}>
                <ListItemIcon>
                  <img src={editImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                </ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>,
              <MenuItem key="delete" onClick={() => {
                handleDeleteLocation(location.id);
                setDeliveryMenuAnchor(null);
              }}>
                <ListItemIcon>
                  <img src={deleteImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>,
            ];
          })()}
        </Menu>

        {/* Add/Edit Delivery Location Dialog */}
        <Dialog open={showAddDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingDeliveryLocation ? 'Edit Delivery Location' : 'Add Delivery Location'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {deliveryError && <Alert severity="error">{deliveryError}</Alert>}

              <TextField
                label="Name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g., Home, Office, Warehouse"
                required
                fullWidth
                autoFocus
              />

              <TextField
                label="Address"
                value={newLocationAddress}
                onChange={(e) => setNewLocationAddress(e.target.value)}
                placeholder="e.g., 123 Main St, New York, NY 10001"
                required
                fullWidth
                multiline
                rows={2}
                helperText="Enter a full address for accurate geocoding"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={geocoding || saving}>
              Cancel
            </Button>
            <Button
              onClick={handleGeocodeAndSave}
              variant="contained"
              disabled={geocoding || saving || !newLocationName.trim() || !newLocationAddress.trim()}
              startIcon={(geocoding || saving) ? <CircularProgress size={20} /> : null}
            >
              {geocoding ? 'Validating...' : saving ? 'Saving...' : (editingDeliveryLocation ? 'Update' : 'Add')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      {/* Admin-only Locations Editor Section */}
      {user?.is_admin && (
        <Box sx={{ mb: 4 }}>
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
              {locations
                .sort((a, b) => a.location_string.localeCompare(b.location_string))
                .map((location) => (
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
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocationsMenuAnchor({ element: e.currentTarget, locationString: location.location_string });
                      }}
                      disabled={retryingLocation === location.location_string}
                    >
                      {retryingLocation === location.location_string ? (
                        <CircularProgress size={20} />
                      ) : (
                        <MoreVertIcon />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Locations Editor Actions Menu */}
      <Menu
        anchorEl={locationsMenuAnchor?.element}
        open={Boolean(locationsMenuAnchor)}
        onClose={() => setLocationsMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {locationsMenuAnchor && (() => {
          const location = locations.find(l => l.location_string === locationsMenuAnchor.locationString);
          if (!location) return null;

          const menuItems = [
            <MenuItem key="retry" onClick={() => {
              handleRetry(location.location_string);
              setLocationsMenuAnchor(null);
            }}>
              <ListItemIcon>
                <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Retry Geocoding</ListItemText>
            </MenuItem>,
          ];

          // Only show "View in Map" if location has coordinates
          if (location.latitude && location.longitude) {
            menuItems.unshift(
              <MenuItem key="view-map" onClick={() => {
                window.open(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`, '_blank');
                setLocationsMenuAnchor(null);
              }}>
                <ListItemIcon>
                  <img src={mapImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                </ListItemIcon>
                <ListItemText>View in Map</ListItemText>
              </MenuItem>
            );
          }

          return menuItems;
        })()}
      </Menu>

          {loading && locations.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SetupPage;
