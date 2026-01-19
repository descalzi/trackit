import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '../assets/logo.png';
import dashboardImage from '../assets/dashboard.png';
import archiveImage from '../assets/archive.png';
import editImage from '../assets/edit.png';
import exitImage from '../assets/exit.png';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setDrawerOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={toggleDrawer(true)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

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
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
      >
        <Box
          sx={{ width: 280 }}
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          {/* User Info Section */}
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={user?.picture}
              alt={user?.name || user?.email}
              sx={{ width: 48, height: 48 }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {user?.name || 'User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Navigation Items */}
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavigation('/')}>
                <ListItemIcon>
                  <img
                    src={dashboardImage}
                    alt="Dashboard"
                    style={{ height: '32px', width: '32px', objectFit: 'contain' }}
                  />
                </ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavigation('/archive')}>
                <ListItemIcon>
                  <img
                    src={archiveImage}
                    alt="Archive"
                    style={{ height: '32px', width: '32px', objectFit: 'contain' }}
                  />
                </ListItemIcon>
                <ListItemText primary="Archive" />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavigation('/admin')}>
                <ListItemIcon>
                  <img
                    src={editImage}
                    alt="Admin"
                    style={{ height: '32px', width: '32px', objectFit: 'contain' }}
                  />
                </ListItemIcon>
                <ListItemText primary="Admin" />
              </ListItemButton>
            </ListItem>
          </List>

          <Divider />

          {/* Logout */}
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <img
                    src={exitImage}
                    alt="Logout"
                    style={{ height: '32px', width: '32px', objectFit: 'contain' }}
                  />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
};

export default Layout;
