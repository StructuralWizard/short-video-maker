import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Paper,
  Chip,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  VideoLibrary as VideoLibraryIcon,
  SmartToy as AIIcon,
  RecordVoiceOver as TTSIcon,
  VideoCall as StudioIcon,
  Settings as SettingsIcon,
  Description as DocsIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import LanguageSwitcher from './LanguageSwitcher';

const drawerWidth = 280;

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    {
      text: t('nav.dashboard'),
      icon: <DashboardIcon />,
      path: '/',
      description: t('nav.description.dashboard'),
    },
    {
      text: t('nav.videoStudio'),
      icon: <StudioIcon />,
      path: '/studio',
      description: t('nav.description.videoStudio'),
      isNew: true,
    },
    {
      text: t('nav.aiScripts'),
      icon: <AIIcon />,
      path: '/ai-scripts',
      description: t('nav.description.aiScripts'),
      isNew: true,
    },
    {
      text: t('nav.library'),
      icon: <VideoLibraryIcon />,
      path: '/library',
      description: t('nav.description.library'),
    },
    {
      text: t('nav.ttsStudio'),
      icon: <TTSIcon />,
      path: '/tts',
      description: t('nav.description.ttsStudio'),
    },
  ];

  const utilityItems = [
    {
      text: t('nav.settings'),
      icon: <SettingsIcon />,
      path: '/settings',
      description: t('nav.description.settings'),
    },
    {
      text: t('nav.apiDocs'),
      icon: <DocsIcon />,
      path: '/api-docs',
      description: t('nav.description.apiDocs'),
      isNew: true,
    },
  ];

  const drawer = (
    <Box
      sx={{
        height: '100%',
        background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.1)})`,
        borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          color: 'white',
        }}
      >
        <Typography variant="h5" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
          Short Video Maker
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {t('nav.description.dashboard')}
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Quick Actions */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            background: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: theme.palette.primary.main }}>
            {t('dashboard.quickActions')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<AddIcon />}
              label={t('dashboard.createNewVideo')}
              size="small"
              onClick={() => navigate('/studio')}
              sx={{
                background: theme.palette.primary.main,
                color: 'white',
                '&:hover': {
                  background: theme.palette.primary.dark,
                },
              }}
            />
            <Chip
              icon={<AIIcon />}
              label="Script IA"
              size="small"
              onClick={() => navigate('/ai-scripts')}
              variant="outlined"
            />
          </Box>
        </Paper>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.3)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                  },
                },
                '&:hover': {
                  background: alpha(theme.palette.action.hover, 0.1),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                }}
              >
                {item.isNew ? (
                  <Badge badgeContent="NEW" color="secondary" variant="dot">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                secondary={item.description}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname === item.path ? 600 : 400,
                  },
                  '& .MuiListItemText-secondary': {
                    fontSize: '0.75rem',
                    opacity: 0.7,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2, my: 2 }} />

      <List sx={{ px: 2 }}>
        {utilityItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  background: alpha(theme.palette.action.selected, 0.2),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                }}
              >
                {item.isNew ? (
                  <Badge badgeContent="NEW" color="secondary" variant="dot">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                secondary={item.description}
                sx={{
                  '& .MuiListItemText-secondary': {
                    fontSize: '0.75rem',
                    opacity: 0.7,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Footer */}
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            background: alpha(theme.palette.background.default, 0.5),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              U
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Usuário
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Criador de conteúdo
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.primary.main, 0.05)})`,
          backdropFilter: 'blur(10px)',
          border: 'none',
          boxShadow: 'none',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageSwitcher />
            <IconButton color="inherit">
              <SearchIcon />
            </IconButton>
            <IconButton color="inherit">
              <Badge badgeContent={3} color="secondary">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: `linear-gradient(145deg, ${theme.palette.background.default}, ${alpha(theme.palette.primary.main, 0.02)})`,
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardLayout; 