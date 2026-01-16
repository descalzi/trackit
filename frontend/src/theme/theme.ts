import { createTheme } from '@mui/material/styles';

// Professional package tracking color palette
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Material Blue (professional, trustworthy)
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#fff',
    },
    secondary: {
      main: '#424242', // Gray (neutral, modern)
      light: '#6d6d6d',
      dark: '#1b1b1b',
      contrastText: '#fff',
    },
    success: {
      main: '#4CAF50', // Green for delivered packages
      light: '#7BC67E',
      dark: '#388E3C',
    },
    warning: {
      main: '#FF9800', // Orange for in-transit packages
      light: '#FFB74D',
      dark: '#F57C00',
    },
    error: {
      main: '#F44336', // Red for exception/failed delivery
      light: '#F6685E',
      dark: '#D32F2F',
    },
    info: {
      main: '#2196F3', // Blue for pending/info
      light: '#64B5F6',
      dark: '#1976D2',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // Mobile-optimized sizes
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
      '@media (min-width:600px)': {
        fontSize: '2.5rem',
      },
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      '@media (min-width:600px)': {
        fontSize: '2rem',
      },
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    button: {
      textTransform: 'none', // Don't uppercase buttons
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8, // Modern, clean corners
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.08)', // Subtle shadow
    '0px 4px 8px rgba(0,0,0,0.1)', // Light shadow
    '0px 6px 12px rgba(0,0,0,0.12)', // Medium shadow
    '0px 8px 16px rgba(0,0,0,0.14)', // Strong shadow
    '0px 10px 20px rgba(0,0,0,0.16)', // Very strong shadow
    '0px 2px 4px rgba(25,118,210,0.2)', // Primary glow (subtle)
    '0px 4px 8px rgba(25,118,210,0.25)', // Primary glow (light)
    '0px 6px 12px rgba(25,118,210,0.3)', // Primary glow (medium)
    '0px 8px 16px rgba(25,118,210,0.35)', // Primary glow (strong)
    '0px 2px 4px rgba(66,66,66,0.2)', // Secondary glow (subtle)
    '0px 4px 8px rgba(66,66,66,0.25)', // Secondary glow (light)
    '0px 6px 12px rgba(66,66,66,0.3)', // Secondary glow (medium)
    '0px 8px 16px rgba(66,66,66,0.35)', // Secondary glow (strong)
    '0px 4px 20px rgba(0,0,0,0.15)', // Elevated
    '0px 6px 24px rgba(0,0,0,0.18)', // Highly elevated
    '0px 8px 28px rgba(0,0,0,0.2)', // Maximum elevation
    '0px 10px 32px rgba(0,0,0,0.22)', // Super elevated
    '0px 12px 36px rgba(0,0,0,0.24)', // Ultra elevated
    '0px 14px 40px rgba(0,0,0,0.26)', // Mega elevated
    '0px 16px 44px rgba(0,0,0,0.28)', // Hyper elevated
    '0px 18px 48px rgba(0,0,0,0.3)', // Maximum possible
    '0px 20px 52px rgba(0,0,0,0.32)', // Maximum possible
    '0px 22px 56px rgba(0,0,0,0.34)', // Maximum possible
    '0px 24px 60px rgba(0,0,0,0.36)', // Maximum possible
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '1rem',
          fontWeight: 500,
        },
        contained: {
          boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 16px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
});

export default theme;
