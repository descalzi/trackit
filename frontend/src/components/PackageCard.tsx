import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import {
  Archive,
  Delete,
  LocalShipping,
  CheckCircle,
  Error as ErrorIcon,
  AccessTime,
} from '@mui/icons-material';
import { Package, PackageStatus } from '../types';
import { formatDistanceToNow } from 'date-fns';
import refreshImage from '../assets/refresh.png';

interface PackageCardProps {
  package: Package;
  onRefresh: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
  loading?: boolean;
}

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

const PackageCard: React.FC<PackageCardProps> = ({
  package: pkg,
  onRefresh,
  onArchive,
  onDelete,
  onClick,
  loading = false,
}) => {
  const handleCardClick = () => {
    onClick(pkg.id);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefresh(pkg.id);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Archive package ${pkg.note || pkg.tracking_number}?`)) {
      onArchive(pkg.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete package ${pkg.note || pkg.tracking_number}? This cannot be undone.`)) {
      onDelete(pkg.id);
    }
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {pkg.note || pkg.tracking_number}
          </Typography>
          {pkg.last_status && (
            <Chip
              label={pkg.last_status}
              color={getStatusColor(pkg.last_status)}
              size="small"
              icon={getStatusIcon(pkg.last_status)}
            />
          )}
        </Box>

        {pkg.note && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {pkg.tracking_number}
          </Typography>
        )}

        {pkg.courier && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Courier: {pkg.courier}
          </Typography>
        )}

        {pkg.last_location && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            📍 {pkg.last_location}
          </Typography>
        )}

        {pkg.last_updated && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {/* @ts-expect-error date-fns v3 type issue */}
            Updated {formatDistanceToNow(new Date(pkg.last_updated), { addSuffix: true })}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Box>
          <Tooltip title="Refresh tracking">
            <IconButton size="small" onClick={handleRefresh} disabled={loading}>
              <img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Archive package">
            <IconButton size="small" onClick={handleArchive} disabled={loading}>
              <Archive />
            </IconButton>
          </Tooltip>
        </Box>
        <Tooltip title="Delete package">
          <IconButton size="small" onClick={handleDelete} disabled={loading} color="error">
            <Delete />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
};

export default PackageCard;
