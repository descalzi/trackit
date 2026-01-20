import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CourierProvider } from './contexts/CourierContext';
import theme from './theme/theme';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PackageDetailPage from './pages/PackageDetailPage';
import ArchivePage from './pages/ArchivePage';
import SetupPage from './pages/SetupPage';
import logoImage from './assets/logo.png';
import loadingGif from './assets/loading.gif';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          gap: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img
            src={logoImage}
            alt="TrackIt Logo"
            style={{ height: '54px', width: '54px', objectFit: 'contain' }}
          />
          <Typography variant="h2" component="div" sx={{ fontWeight: 700, color: 'primary.main', textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)' }}>
            TrackIt
          </Typography>
        </Box>
        <img
          src={loadingGif}
          alt="Loading"
          style={{ height: '100px', width: '100px', objectFit: 'contain' }}
        />
        <Typography component="div">
            loading ...
          </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Get basename for router based on environment
const getBasename = () => {
  if (import.meta.env.PROD) {
    return '/trackit';
  }
  return '/';
};

const App: React.FC = () => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  if (!googleClientId) {
    console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables');
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <CourierProvider>
            <BrowserRouter basename={getBasename()}>
              <Routes>
                {/* Public route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes with Layout */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="package/:id" element={<PackageDetailPage />} />
                  <Route path="archive" element={<ArchivePage />} />
                  <Route path="setup" element={<SetupPage />} />
                </Route>

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </CourierProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
