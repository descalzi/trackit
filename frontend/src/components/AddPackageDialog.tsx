import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { PackageCreate } from '../types';
import { useCouriers } from '../contexts/CourierContext';
import { getFaviconUrl } from '../utils/favicon';
import packageImage from '../assets/package.png';

interface AddPackageDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (packageData: PackageCreate) => Promise<void>;
}

const AddPackageDialog: React.FC<AddPackageDialogProps> = ({ open, onClose, onAdd }) => {
  const { couriers } = useCouriers();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState<string>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = () => {
    setTrackingNumber('');
    setCourier('');
    setNote('');
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      setError('Tracking number is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create package - backend will automatically fetch tracking data
      const packageData: PackageCreate = {
        tracking_number: trackingNumber.trim(),
        courier: courier || undefined,
        note: note.trim() || undefined,
      };

      await onAdd(packageData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Package</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img
              src={packageImage}
              alt="Package"
              style={{ height: '120px', width: '120px', objectFit: 'contain' }}
            />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Tracking Number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
            required
            fullWidth
            autoFocus
          />

          <TextField
            select
            label="Courier (Optional)"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            helperText="Leave blank for auto-detection"
            fullWidth
          >
            <MenuItem value="">Auto Detect</MenuItem>
            {couriers
              .filter(c => !c.isDeprecated)
              .sort((a, b) => a.courierName.localeCompare(b.courierName))
              .map((c) => (
                <MenuItem key={c.courierCode} value={c.courierCode}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {c.website && (
                      <img
                        src={getFaviconUrl(c.website, 16)}
                        alt=""
                        style={{ width: 16, height: 16 }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span>{c.courierName}</span>
                  </Box>
                </MenuItem>
              ))}
          </TextField>

          <TextField
            label="Note (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Amazon Order #123"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !trackingNumber.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Adding...' : 'Add Package'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPackageDialog;
