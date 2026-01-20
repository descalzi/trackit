import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button,
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
  ArrowBack,
  LocalShipping,
  CheckCircle,
  Error as ErrorIcon,
  AccessTime,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { usePackages } from '../hooks/usePackages';
import { useTracking } from '../hooks/useTracking';
import EditPackageDialog from '../components/EditPackageDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { PackageStatus } from '../types';
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

const ArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const { packages, loading, error, refresh, deletePackage, unarchivePackage, updatePackage } = usePackages(true);
  const { refresh: refreshTracking } = useTracking();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<{ id: string; note: string; delivery_location_id?: string } | null>(null);
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
      await refresh();
    } catch (err) {
      console.error('Failed to refresh package:', err);
    } finally {
      setRefreshingId(null);
    }
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

  const handleUnarchive = (id: string, note: string, trackingNumber: string) => {
    handleMenuClose();
    setConfirmDialog({
      open: true,
      title: 'Unarchive Package',
      message: `Unarchive package ${note || trackingNumber}?`,
      confirmColor: 'primary',
      onConfirm: async () => {
        await unarchivePackage(id);
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

  const handlePackageClick = (id: string) => {
    navigate(`/package/${id}`);
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
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Back to Dashboard
      </Button>

      <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
        Archived Packages
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {packages.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 3 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No archived packages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Delivered packages will appear here when you archive them
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 1 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Status</TableCell>
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
                    {pkg.last_location && (
                      <Typography variant="body2">
                        📍 {pkg.last_location}
                      </Typography>
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
            <MenuItem key="unarchive" onClick={() => handleUnarchive(pkg.id, pkg.note || '', pkg.tracking_number)}>
              <ListItemIcon>
                <img src={archiveImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
              </ListItemIcon>
              <ListItemText>Unarchive</ListItemText>
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

export default ArchivePage;
