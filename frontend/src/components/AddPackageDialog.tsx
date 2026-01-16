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
import { CourierType, PackageCreate } from '../types';
import { useTracking } from '../hooks/useTracking';

interface AddPackageDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (packageData: PackageCreate) => Promise<void>;
}

const AddPackageDialog: React.FC<AddPackageDialogProps> = ({ open, onClose, onAdd }) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState<CourierType | ''>('');
  const [nickname, setNickname] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { lookup } = useTracking();

  const handleReset = () => {
    setTrackingNumber('');
    setCourier('');
    setNickname('');
    setDescription('');
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
      // Optional: Preview tracking before saving
      const lookupResult = await lookup({
        tracking_number: trackingNumber.trim(),
        courier: courier || undefined,
      });

      if (!lookupResult) {
        // Lookup failed but we can still save it
        console.warn('Tracking lookup failed, but will save package anyway');
      }

      // Create package
      const packageData: PackageCreate = {
        tracking_number: trackingNumber.trim(),
        courier: courier || undefined,
        nickname: nickname.trim() || undefined,
        description: description.trim() || undefined,
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
            onChange={(e) => setCourier(e.target.value as CourierType | '')}
            helperText="Leave blank for auto-detection"
            fullWidth
          >
            <MenuItem value="">Auto Detect</MenuItem>
            <MenuItem value={CourierType.EVRI}>Evri</MenuItem>
            <MenuItem value={CourierType.ROYAL_MAIL}>Royal Mail</MenuItem>
            <MenuItem value={CourierType.DPD}>DPD</MenuItem>
            <MenuItem value={CourierType.OTHER}>Other</MenuItem>
          </TextField>

          <TextField
            label="Nickname (Optional)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g., Amazon Order #123"
            fullWidth
          />

          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes about this package"
            multiline
            rows={3}
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
