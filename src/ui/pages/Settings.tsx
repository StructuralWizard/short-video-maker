import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const Settings: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    defaultVoice: 'Paulo',
    defaultLanguage: 'pt',
    defaultOrientation: 'portrait',
    defaultMusicVolume: 'medium',
    autoSave: true,
    notifications: true,
    darkMode: true,
    videoQuality: 'high',
  });
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = () => {
    // Save to localStorage or API
    localStorage.setItem('userSettings', JSON.stringify(settings));
    setSuccess(t('settings.settingsSaved'));
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('settings.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('settings.subtitle')}
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                {t('settings.videoDefaults')}
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('settings.defaultVoice')}</InputLabel>
                    <Select
                      value={settings.defaultVoice}
                      label={t('settings.defaultVoice')}
                      onChange={(e) => setSettings({...settings, defaultVoice: e.target.value})}
                    >
                                             <MenuItem value="Paulo">Paulo</MenuItem>
                       <MenuItem value="Noel">Noel</MenuItem>
                       <MenuItem value="Scarlett">Scarlett</MenuItem>
                       <MenuItem value="NinoCoelho">NinoCoelho</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('settings.defaultLanguage')}</InputLabel>
                    <Select
                      value={settings.defaultLanguage}
                      label={t('settings.defaultLanguage')}
                      onChange={(e) => setSettings({...settings, defaultLanguage: e.target.value})}
                    >
                      <MenuItem value="pt">{t('common.portuguese')}</MenuItem>
                      <MenuItem value="en">{t('common.english')}</MenuItem>
                      <MenuItem value="es">{t('common.spanish')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('settings.defaultOrientation')}</InputLabel>
                    <Select
                      value={settings.defaultOrientation}
                      label={t('settings.defaultOrientation')}
                      onChange={(e) => setSettings({...settings, defaultOrientation: e.target.value})}
                    >
                      <MenuItem value="portrait">{t('settings.portrait')}</MenuItem>
                      <MenuItem value="landscape">{t('settings.landscape')}</MenuItem>
                      <MenuItem value="square">{t('settings.square')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                {t('settings.preferences')}
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoSave}
                      onChange={(e) => setSettings({...settings, autoSave: e.target.checked})}
                    />
                  }
                  label={t('settings.autoSave')}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications}
                      onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
                    />
                  }
                  label={t('settings.notifications')}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.darkMode}
                      onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
                    />
                  }
                  label={t('settings.darkMode')}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          }}
        >
          Salvar Configurações
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => setSettings({
            defaultVoice: 'Paulo',
            defaultLanguage: 'pt',
            defaultOrientation: 'portrait',
            defaultMusicVolume: 'medium',
            autoSave: true,
            notifications: true,
            darkMode: true,
            videoQuality: 'high',
          })}
        >
          Restaurar Padrões
        </Button>
      </Box>
    </Box>
  );
};

export default Settings; 