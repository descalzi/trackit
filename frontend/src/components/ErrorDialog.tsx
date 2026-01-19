import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import packageErrorImage from '../assets/package_error.png';

interface ErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({
  open,
  title = 'Error',
  message,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <img
          src={packageErrorImage}
          alt=""
          style={{ height: '32px', width: '32px', objectFit: 'contain' }}
        />
        <Typography sx={{ whiteSpace: 'pre-line' }}>
          {message}
        </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="error">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ErrorDialog;
