import React, { useState } from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import ErrorDialog from '../components/ErrorDialog';
import logoImage from '../assets/logo.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log('Attempting to authenticate with backend...');
      const response = await apiClient.auth.googleAuth(credentialResponse.credential);
      console.log('Authentication successful!', response);
      login(response.access_token, response.user);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrorDialog({
        open: true,
        message: `Login failed: ${errorMessage}\n\nCheck the browser console for details.`,
      });
    }
  };

  const handleCloseErrorDialog = () => {
    setErrorDialog({ open: false, message: '' });
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <img
            src={logoImage}
            alt="TrackIt Logo"
            style={{ height: '54px', width: '54px', objectFit: 'contain', marginBottom:1 }}
          />
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            TrackIt
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Track your deliveries around the world
          </Typography>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.error('Login Failed');
              setErrorDialog({
                open: true,
                message: 'Login failed. Please try again.',
              });
            }}
            useOneTap
          />
        </Paper>
      </Box>

      <ErrorDialog
        open={errorDialog.open}
        title="Login Error"
        message={errorDialog.message}
        onClose={handleCloseErrorDialog}
      />
    </Container>
  );
};

export default LoginPage;
