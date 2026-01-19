import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';

interface EditPackageDialogProps {
  open: boolean;
  initialNote?: string;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}

const EditPackageDialog: React.FC<EditPackageDialogProps> = ({
  open,
  initialNote = '',
  onClose,
  onSave,
}) => {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  // Update local note when initialNote changes
  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(note);
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
