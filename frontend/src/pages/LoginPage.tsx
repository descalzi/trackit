import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

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
      alert(`Login failed: ${errorMessage}\n\nCheck the browser console for details.`);
    }
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
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            TrackIt
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Track packages from Evri, Royal Mail, DPD and more
          </Typography>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.error('Login Failed');
              alert('Login failed. Please try again.');
            }}
            useOneTap
          />
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
