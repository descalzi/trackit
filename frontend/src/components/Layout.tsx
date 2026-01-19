import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Container,
  Avatar,
  Tooltip,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '../assets/logo.png';
import dashboardImage from '../assets/dashboard.png';
import archiveImage from '../assets/archive.png';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexGrow: 1,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/')}
          >
            <img
              src={logoImage}
              alt="TrackIt Logo"
              style={{ height: '32px', width: '32px', objectFit: 'contain' }}
            />
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              TrackIt
            </Typography>
          </Box>

          <Tooltip title="Dashboard">
            <IconButton color="inherit" onClick={() => navigate('/')}>
              <img
                src={dashboardImage}
                alt="Dashboard"
                style={{ height: '24px', width: '24px', objectFit: 'contain' }}
              />
            </IconButton>
          </Tooltip>

          <Tooltip title="Archive">
            <IconButton color="inherit" onClick={() => navigate('/archive')}>
              <img
                src={archiveImage}
                alt="Archive"
                style={{ height: '24px', width: '24px', objectFit: 'contain' }}
              />
            </IconButton>
          </Tooltip>

          <IconButton
            size="large"
            onClick={handleMenu}
            color="inherit"
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={user?.picture}
              alt={user?.name || user?.email}
              sx={{ width: 32, height: 32 }}
            />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
};

export default Layout;
