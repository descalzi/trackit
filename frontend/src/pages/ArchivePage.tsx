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
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Unarchive,
  LocalShipping,
  CheckCircle,
  Error as ErrorIcon,
  AccessTime,
} from '@mui/icons-material';
import { usePackages } from '../hooks/usePackages';
import { useTracking } from '../hooks/useTracking';
import ConfirmDialog from '../components/ConfirmDialog';
import { PackageStatus } from '../types';
import refreshImage from '../assets/refresh.png';
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

const ArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const { packages, loading, error, refresh, deletePackage, unarchivePackage } = usePackages(true);
  const { refresh: refreshTracking } = useTracking();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
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

  const handleRefreshPackage = async (id: string) => {
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

  const handleUnarchive = (id: string, note: string, trackingNumber: string) => {
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
              {packages.map((pkg) => (
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
                        {formatDistanceToNow(new Date(pkg.last_updated), { addSuffix: true })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Refresh tracking">
                      <IconButton
                        size="small"
                        onClick={() => handleRefreshPackage(pkg.id)}
                        disabled={refreshingId === pkg.id}
                      >
                        <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Unarchive package">
                      <IconButton
                        size="small"
                        onClick={() => handleUnarchive(pkg.id, pkg.note || '', pkg.tracking_number)}
                        disabled={refreshingId === pkg.id}
                      >
                        <img src={archiveImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete package">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(pkg.id, pkg.note || '', pkg.tracking_number)}
                        disabled={refreshingId === pkg.id}
                      >
                        <img src={deleteImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
