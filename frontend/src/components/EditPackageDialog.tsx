import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  MenuItem,
} from '@mui/material';
import { apiClient } from '../api/client';

interface EditPackageDialogProps {
  open: boolean;
  initialNote?: string;
  initialDeliveryLocationId?: string;
  onClose: () => void;
  onSave: (note: string, deliveryLocationId?: string | null) => Promise<void>;
}

const EditPackageDialog: React.FC<EditPackageDialogProps> = ({
  open,
  initialNote = '',
  initialDeliveryLocationId = '',
  onClose,
  onSave,
}) => {
  const [note, setNote] = useState(initialNote);
  const [deliveryLocationId, setDeliveryLocationId] = useState(initialDeliveryLocationId);
  const [deliveryLocations, setDeliveryLocations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch delivery locations when dialog opens
  useEffect(() => {
    if (open) {
      apiClient.deliveryLocations.getAll()
        .then(locations => setDeliveryLocations(locations))
        .catch(err => console.error('Failed to fetch delivery locations:', err));
    }
  }, [open]);

  // Update local state when props change
  useEffect(() => {
    setNote(initialNote);
    setDeliveryLocationId(initialDeliveryLocationId);
  }, [initialNote, initialDeliveryLocationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Send null when empty string to explicitly clear the delivery location
      await onSave(note, deliveryLocationId === '' ? null : deliveryLocationId);
      onClose();
    } catch (err) {
      console.error('Failed to save package:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Package</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Amazon Order #123"
            fullWidth
            autoFocus
          />

          <TextField
            select
            label="Delivery Location (Optional)"
            value={deliveryLocationId}
            onChange={(e) => setDeliveryLocationId(e.target.value)}
            helperText={deliveryLocations.length === 0 ? "Add delivery locations in Setup" : "Where will this package be delivered?"}
            fullWidth
            slotProps={{
              inputLabel: { shrink: true },
              select: {
                displayEmpty: true,
                MenuProps: {
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                },
              },
            }}
          >
            <MenuItem value="">Don't set a deliverylocation</MenuItem>
            {deliveryLocations.map((location) => (
              <MenuItem key={location.id} value={location.id}>
                {location.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPackageDialog;
