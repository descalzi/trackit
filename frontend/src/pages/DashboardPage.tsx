import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Fab,
} from '@mui/material';
import { usePackages } from '../hooks/usePackages';
import { useTracking } from '../hooks/useTracking';
import PackageCard from '../components/PackageCard';
import AddPackageDialog from '../components/AddPackageDialog';
import { PackageCreate } from '../types';
import packageAddImage from '../assets/package_add.png';
import refreshImage from '../assets/refresh.png';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { packages, loading, error, refresh, createPackage, deletePackage, archivePackage } = usePackages(false);
  const { refresh: refreshTracking } = useTracking();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const handleAddPackage = async (packageData: PackageCreate) => {
    await createPackage(packageData);
  };

  const handleRefreshPackage = async (id: string) => {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={600}>
          My Packages
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<img src={refreshImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain' }} />}
            onClick={refresh}
          >
            Refresh All
          </Button>
          <Button
            variant="contained"
            startIcon={<img src={packageAddImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
            onClick={() => setDialogOpen(true)}
          >
            Add Package
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
            startIcon={<img src={packageAddImage} alt="" style={{ height: '20px', width: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
            onClick={() => setDialogOpen(true)}
          >
            Add Your First Package
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {packages.map((pkg) => (
            <Grid item xs={12} sm={6} md={4} key={pkg.id}>
              <PackageCard
                package={pkg}
                onRefresh={handleRefreshPackage}
                onArchive={archivePackage}
                onDelete={deletePackage}
                onClick={handlePackageClick}
                loading={refreshingId === pkg.id}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' },
        }}
        onClick={() => setDialogOpen(true)}
      >
        <img src={packageAddImage} alt="" style={{ height: '24px', width: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </Fab>

      <AddPackageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddPackage}
      />
    </Box>
  );
};

export default DashboardPage;
