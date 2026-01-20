import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  LocalShipping,
  CheckCircle,
  Error as ErrorIcon,
  AccessTime,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { usePackages } from '../hooks/usePackages';
import { useTracking } from '../hooks/useTracking';
import { useCouriers } from '../contexts/CourierContext';
import AddPackageDialog from '../components/AddPackageDialog';
import EditPackageDialog from '../components/EditPackageDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { PackageCreate, PackageStatus } from '../types';
import { getFaviconUrl } from '../utils/favicon';
import packageAddImage from '../assets/package_add_white.png';
import refreshImage from '../assets/refresh.png';
import editImage from '../assets/edit.png';
import archiveImage from '../assets/archive.png';
import deleteImage from '../assets/delete.png';
import { formatDistanceToNow } from 'date-fns';

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
      return <CheckCircle fontSize="small" />;
    case PackageStatus.OUT_FOR_DELIVERY:
      return <LocalShipping fontSize="small" />;
    case PackageStatus.IN_TRANSIT:
      return <LocalShipping fontSize="small" />;
    case PackageStatus.EXCEPTION:
      return <ErrorIcon fontSize="small" />;
    case PackageStatus.PENDING:
      return <AccessTime fontSize="small" />;
    default:
      return <AccessTime fontSize="small" />;
  }
};

// Helper function to get status priority for sorting
const getStatusPriority = (status?: PackageStatus): number => {
  switch (status) {
    case PackageStatus.EXCEPTION:
      return 0; // Highest priority - needs attention
    case PackageStatus.OUT_FOR_DELIVERY:
      return 1; // Imminent delivery
    case PackageStatus.IN_TRANSIT:
      return 2; // Active tracking
    case PackageStatus.PENDING:
      return 3; // Waiting to start
    case PackageStatus.DELIVERED:
      return 4; // Lowest priority - completed
    default:
      return 5; // Unknown status
  }
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { packages, loading, error, refresh, createPackage, deletePackage, archivePackage, updatePackage } = usePackages(false);
  const { refresh: refreshTracking } = useTracking();
  const { getCourierByCode } = useCouriers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<{ id: string; note: string; delivery_location_id?: string } | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; packageId: string } | null>(null);
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

  // Sort packages by status priority, then by last updated time
  const sortedPackages = [...packages].sort((a, b) => {
    const priorityDiff = getStatusPriority(a.last_status) - getStatusPriority(b.last_status);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // Within same status, sort by most recent first
    const aTime = a.last_updated ? new Date(a.last_updated).getTime() : 0;
    const bTime = b.last_updated ? new Date(b.last_updated).getTime() : 0;
    return bTime - aTime;
  });

  const handleAddPackage = async (packageData: PackageCreate) => {
    await createPackage(packageData);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, packageId: string) => {
    event.stopPropagation();
    setMenuAnchor({ element: event.currentTarget, packageId });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleRefreshPackage = async (id: string) => {
    handleMenuClose();
    setRefreshingId(id);
    try {
      await refreshTracking(id);
      await refresh(); // Refresh the list to show updated data
    } catch (err) {
      console.error('Failed to refresh package:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingId('all');
    try {
      // Filter out delivered packages and refresh the rest
      const packagesToRefresh = sortedPackages.filter(pkg => pkg.last_status !== PackageStatus.DELIVERED);

      // Refresh all non-delivered packages sequentially to avoid rate limiting
      for (const pkg of packagesToRefresh) {
        try {
          await refreshTracking(pkg.id);
        } catch (err) {
          console.error(`Failed to refresh package ${pkg.id}:`, err);
        }
      }

      // Refresh the list to show all updated data
      await refresh();
    } catch (err) {
      console.error('Failed to refresh all packages:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handlePackageClick = (id: string) => {
    navigate(`/package/${id}`);
  };

  const handleEdit = (id: string, note: string, deliveryLocationId?: string) => {
    handleMenuClose();
    setEditingPackage({ id, note, delivery_location_id: deliveryLocationId });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (note: string, deliveryLocationId?: string | null) => {
    if (!editingPackage) return;
    await updatePackage(editingPackage.id, { note, delivery_location_id: deliveryLocationId });
    setEditingPackage(null);
  };

  const handleArchive = (id: string, note: string, trackingNumber: string) => {
    handleMenuClose();
    setConfirmDialog({
      open: true,
      title: 'Archive Package',
      message: `Archive package ${note || trackingNumber}?`,
      confirmColor: 'primary',
      onConfirm: async () => {
        await archivePackage(id);
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  const handleDelete = (id: string, note: string, trackingNumber: string) => {
    handleMenuClose();
    setConfirmDialog({
      open: true,
      title: 'Delete Package',
      message: `Delete package ${note || trackingNumber}? This cannot be undone.`,
      confirmColor: 'error',
      onConfirm: async () => {
        await deletePackage(id);
        setConfirmDialog({ ...confirmDialog, open: false });
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={600}>
          Packages
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={refreshingId === 'all' ? <CircularProgress size={20} /> : <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />}
            onClick={handleRefreshAll}
            disabled={refreshingId === 'all' || packages.length === 0}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<img src={packageAddImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />}
            onClick={() => setDialogOpen(true)}
          >
            Add
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {packages.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No packages yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click "Add Package" to start tracking your first package
          </Typography>
          <Button
            variant="contained"
            startIcon={<img src={packageAddImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />}
            onClick={() => setDialogOpen(true)}
          >
            Add Your First Package
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Courier</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPackages.map((pkg) => (
                <TableRow
                  key={pkg.id}
                  hover
                  sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                  onClick={() => handlePackageClick(pkg.id)}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {pkg.note || pkg.tracking_number}
                      </Typography>
                      {pkg.note && (
                        <Typography variant="body2" color="text.secondary">
                          {pkg.tracking_number}
                        </Typography>
                      )}
                      {pkg.courier && (
                        <Typography variant="caption" color="text.secondary">
                          {pkg.courier}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {pkg.last_status && (
                      <Chip
                        label={pkg.last_status}
                        color={getStatusColor(pkg.last_status)}
                        size="small"
                        icon={getStatusIcon(pkg.last_status)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.detected_courier && (() => {
                      const courier = getCourierByCode(pkg.detected_courier);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {courier?.website && (
                            <img
                              src={getFaviconUrl(courier.website, 16)}
                              alt=""
                              style={{ width: 16, height: 16 }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <Typography variant="body2">
                            {courier?.courierName || pkg.detected_courier}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {pkg.last_location && (
                      <Typography variant="body2">
                        {pkg.last_location}
                      </Typography>
                    )}
                    {!pkg.last_location && (pkg.origin_country || pkg.destination_country) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {pkg.origin_country && (
                          <img
                            src={`https://flagcdn.com/16x12/${pkg.origin_country.toLowerCase()}.png`}
                            srcSet={`https://flagcdn.com/32x24/${pkg.origin_country.toLowerCase()}.png 2x, https://flagcdn.com/48x36/${pkg.origin_country.toLowerCase()}.png 3x`}
                            width="16"
                            height="12"
                            alt={pkg.origin_country}
                            style={{ border: '1px solid #e0e0e0' }}
                          />
                        )}
                        {pkg.origin_country && pkg.destination_country && (
                          <Typography variant="caption" color="text.secondary">→</Typography>
                        )}
                        {pkg.destination_country && (
                          <img
                            src={`https://flagcdn.com/16x12/${pkg.destination_country.toLowerCase()}.png`}
                            srcSet={`https://flagcdn.com/32x24/${pkg.destination_country.toLowerCase()}.png 2x, https://flagcdn.com/48x36/${pkg.destination_country.toLowerCase()}.png 3x`}
                            width="16"
                            height="12"
                            alt={pkg.destination_country}
                            style={{ border: '1px solid #e0e0e0' }}
                          />
                        )}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.last_updated && (
                      <Typography variant="body2" color="text.secondary">
                        {/* @ts-expect-error date-fns v3 type issue */}
                        {formatDistanceToNow(new Date(pkg.last_updated), { addSuffix: true })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, pkg.id)}
                      disabled={refreshingId === pkg.id}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Package Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {menuAnchor && (() => {
          const pkg = sortedPackages.find(p => p.id === menuAnchor.packageId);
          if (!pkg) return null;

          return [
            <MenuItem key="refresh" onClick={() => handleRefreshPackage(pkg.id)}>
              <ListItemIcon>
                <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Refresh Tracking</ListItemText>
            </MenuItem>,
            <MenuItem key="edit" onClick={() => handleEdit(pkg.id, pkg.note || '', pkg.delivery_location_id)}>
              <ListItemIcon>
                <img src={editImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>,
            <MenuItem key="archive" onClick={() => handleArchive(pkg.id, pkg.note || '', pkg.tracking_number)}>
              <ListItemIcon>
                <img src={archiveImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Archive</ListItemText>
            </MenuItem>,
            <MenuItem key="delete" onClick={() => handleDelete(pkg.id, pkg.note || '', pkg.tracking_number)}>
              <ListItemIcon>
                <img src={deleteImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>,
          ];
        })()}
      </Menu>

      <AddPackageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddPackage}
      />

      <EditPackageDialog
        open={editDialogOpen}
        initialNote={editingPackage?.note || ''}
        initialDeliveryLocationId={editingPackage?.delivery_location_id || ''}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingPackage(null);
        }}
        onSave={handleSaveEdit}
      />

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

export default DashboardPage;
