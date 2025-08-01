import React from 'react';
import { FormControl, Select, MenuItem, SelectChangeEvent, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Language as LanguageIcon } from '@mui/icons-material';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (event: SelectChangeEvent) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
        startAdornment={<LanguageIcon sx={{ mr: 1, fontSize: 16 }} />}
        sx={{ 
          '& .MuiSelect-select': { 
            display: 'flex', 
            alignItems: 'center' 
          } 
        }}
      >
        <MenuItem value="pt">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🇧🇷 {t('common.portuguese')}
          </Box>
        </MenuItem>
        <MenuItem value="en">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🇺🇸 {t('common.english')}
          </Box>
        </MenuItem>
        <MenuItem value="es">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🇪🇸 {t('common.spanish')}
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );
};

export default LanguageSwitcher;
