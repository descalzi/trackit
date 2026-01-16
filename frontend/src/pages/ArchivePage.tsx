import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Button,
} from '@mui/material';
import { ArrowBack, Unarchive } from '@mui/icons-material';
import { usePackages } from '../hooks/usePackages';
import { useTracking } from '../hooks/useTracking';
import PackageCard from '../components/PackageCard';

const ArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const { packages, loading, error, refresh, deletePackage, unarchivePackage } = usePackages(true);
  const { refresh: refreshTracking } = useTracking();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

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

  const handleUnarchive = async (id: string) => {
    await unarchivePackage(id);
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
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {packages.map((pkg) => (
            <Grid item xs={12} sm={6} md={4} key={pkg.id}>
              <PackageCard
                package={pkg}
                onRefresh={handleRefreshPackage}
                onArchive={handleUnarchive}
                onDelete={deletePackage}
                onClick={handlePackageClick}
                loading={refreshingId === pkg.id}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ArchivePage;
