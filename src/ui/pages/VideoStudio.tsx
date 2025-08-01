import React, { useState, useEffect } from 'react';
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
  Chip,
  IconButton,
  Paper,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  SmartToy as AIIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  SceneInput,
  RenderConfig,
  VoiceEnum,
  OrientationEnum,
  MusicMoodEnum,
  CaptionPositionEnum,
  MusicVolumeEnum,
} from '../../types/shorts';

interface FormData {
  scenes: SceneInput[];
  config: RenderConfig;
}

const VideoStudio: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const steps = [
    t('videoStudio.steps.script'),
    t('videoStudio.steps.settings'), 
    t('videoStudio.steps.review')
  ];

  const [formData, setFormData] = useState<FormData>({
    scenes: [
      {
        text: '',
        searchTerms: [],
      },
    ],
    config: {
      paddingBack: 3000,
      music: MusicMoodEnum.chill,
      captionPosition: CaptionPositionEnum.bottom,
      captionBackgroundColor: '#000000',
      captionTextColor: '#ffffff',
      voice: VoiceEnum.Paulo,
      orientation: OrientationEnum.portrait,
      musicVolume: MusicVolumeEnum.medium,
      language: 'pt' as 'pt' | 'en',
    },
  });

  const [availableOptions, setAvailableOptions] = useState({
    voices: Object.values(VoiceEnum),
    musicTags: Object.values(MusicMoodEnum),
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const [voicesResponse, musicResponse] = await Promise.all([
          axios.get('/api/voices'),
          axios.get('/api/music-tags'),
        ]);

        setAvailableOptions({
          voices: voicesResponse.data,
          musicTags: musicResponse.data,
        });
      } catch (err) {
        console.error('Failed to fetch options:', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleSceneChange = (index: number, field: keyof SceneInput, value: any) => {
    const newScenes = [...formData.scenes];
    if (field === 'searchTerms' && typeof value === 'string') {
      newScenes[index] = {
        ...newScenes[index],
        [field]: value.split(',').map((term: string) => term.trim()).filter(Boolean),
      };
    } else {
      newScenes[index] = {
        ...newScenes[index],
        [field]: value,
      };
    }
    setFormData({ ...formData, scenes: newScenes });
  };

  const handleConfigChange = (field: keyof RenderConfig, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [field]: value,
      },
    });
  };

  const addScene = () => {
    setFormData({
      ...formData,
      scenes: [
        ...formData.scenes,
        {
          text: '',
          searchTerms: [],
        },
      ],
    });
  };

  const removeScene = (index: number) => {
    if (formData.scenes.length > 1) {
      const newScenes = formData.scenes.filter((_, i) => i !== index);
      setFormData({ ...formData, scenes: newScenes });
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate scenes
      const hasValidScenes = formData.scenes.every(scene => 
        scene.text.trim() && scene.searchTerms.length > 0
      );
      if (!hasValidScenes) {
        setError('Por favor, preencha todos os campos das cenas');
        return;
      }
    }
    setError(null);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await axios.post('/api/render', {
        scenes: formData.scenes,
        config: formData.config,
      });

      const newVideoId = response.data.videoId;
      setVideoId(newVideoId);
      setSuccess('Vídeo adicionado à fila de processamento!');
      
      setTimeout(() => {
        navigate(`/video/${newVideoId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error creating video:', err);
      setError(err.response?.data?.error || 'Erro ao criar vídeo');
    } finally {
      setLoading(false);
    }
  };

  const generateAIScript = () => {
    navigate('/ai-scripts', { state: { returnTo: '/studio' } });
  };

  const renderSceneStep = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {t('videoStudio.scenes.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AIIcon />}
            onClick={generateAIScript}
            sx={{ mr: 1 }}
          >
            {t('videoStudio.scenes.generateAI')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addScene}
          >
            {t('videoStudio.scenes.addScene')}
          </Button>
        </Box>
      </Box>

      {formData.scenes.map((scene, index) => (
        <Accordion
          key={index}
          defaultExpanded={index === 0}
          sx={{
            mb: 2,
            '&:before': { display: 'none' },
            boxShadow: 'none',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                {t('videoStudio.scenes.sceneNumber', { number: index + 1 })}
              </Typography>
              {formData.scenes.length > 1 && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScene(index);
                  }}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={t('videoStudio.scenes.sceneText')}
                  placeholder={t('videoStudio.scenes.sceneText')}
                  value={scene.text}
                  onChange={(e) => handleSceneChange(index, 'text', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('videoStudio.scenes.searchTerms')}
                  placeholder="palavra1, palavra2, palavra3"
                  value={scene.searchTerms.join(', ')}
                  onChange={(e) => handleSceneChange(index, 'searchTerms', e.target.value)}
                  helperText={t('videoStudio.scenes.searchTermsHelper')}
                  variant="outlined"
                />
              </Grid>
              {scene.searchTerms.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {scene.searchTerms.map((term, termIndex) => (
                      <Chip
                        key={termIndex}
                        label={term}
                        size="small"
                        onDelete={() => {
                          const newTerms = scene.searchTerms.filter((_, i) => i !== termIndex);
                          handleSceneChange(index, 'searchTerms', newTerms.join(', '));
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderConfigStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        {t('videoStudio.config.videoConfig')}
      </Typography>

      <Grid container spacing={3}>
        {/* Audio Settings */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {t('videoStudio.config.audioSettings')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('videoStudio.config.voice')}</InputLabel>
                  <Select
                    value={formData.config.voice}
                    label={t('videoStudio.config.voice')}
                    onChange={(e) => handleConfigChange('voice', e.target.value)}
                  >
                    {availableOptions.voices.map((voice) => (
                      <MenuItem key={voice} value={voice}>
                        {voice.replace('_', ' ').toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('videoStudio.config.language')}</InputLabel>
                  <Select
                    value={formData.config.language}
                    label={t('videoStudio.config.language')}
                    onChange={(e) => handleConfigChange('language', e.target.value)}
                  >
                    <MenuItem value="pt">{t('videoStudio.languages.pt')}</MenuItem>
                    <MenuItem value="en">{t('videoStudio.languages.en')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Video Settings */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Configurações de Vídeo
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Orientação</InputLabel>
                  <Select
                    value={formData.config.orientation}
                    label="Orientação"
                    onChange={(e) => handleConfigChange('orientation', e.target.value)}
                  >
                    <MenuItem value={OrientationEnum.portrait}>Retrato (9:16)</MenuItem>
                    <MenuItem value={OrientationEnum.landscape}>Paisagem (16:9)</MenuItem>
                    <MenuItem value={OrientationEnum.square}>Quadrado (1:1)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Posição das Legendas</InputLabel>
                  <Select
                    value={formData.config.captionPosition}
                    label="Posição das Legendas"
                    onChange={(e) => handleConfigChange('captionPosition', e.target.value)}
                  >
                    <MenuItem value={CaptionPositionEnum.top}>Topo</MenuItem>
                    <MenuItem value={CaptionPositionEnum.center}>Centro</MenuItem>
                    <MenuItem value={CaptionPositionEnum.bottom}>Inferior</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Music Settings */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Configurações de Música
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Humor da Música</InputLabel>
                  <Select
                    value={formData.config.music}
                    label="Humor da Música"
                    onChange={(e) => handleConfigChange('music', e.target.value)}
                  >
                    {availableOptions.musicTags.map((tag) => (
                      <MenuItem key={tag} value={tag}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Volume da Música</InputLabel>
                  <Select
                    value={formData.config.musicVolume}
                    label="Volume da Música"
                    onChange={(e) => handleConfigChange('musicVolume', e.target.value)}
                  >
                    <MenuItem value={MusicVolumeEnum.muted}>Mudo</MenuItem>
                    <MenuItem value={MusicVolumeEnum.low}>Baixo</MenuItem>
                    <MenuItem value={MusicVolumeEnum.medium}>Médio</MenuItem>
                    <MenuItem value={MusicVolumeEnum.high}>Alto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Advanced Settings */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Configurações Avançadas
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tempo após fala (ms)"
                  value={formData.config.paddingBack}
                  onChange={(e) => handleConfigChange('paddingBack', parseInt(e.target.value))}
                  helperText="Tempo de vídeo após terminar a narração"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cor do fundo da legenda"
                  type="color"
                  value={formData.config.captionBackgroundColor}
                  onChange={(e) => handleConfigChange('captionBackgroundColor', e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
        Revisão Final
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Cenas ({formData.scenes.length})
            </Typography>
            {formData.scenes.map((scene, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Cena {index + 1}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {scene.text}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {scene.searchTerms.map((term, termIndex) => (
                    <Chip key={termIndex} label={term} size="small" />
                  ))}
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Configurações
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Orientação:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formData.config.orientation}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Voz:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formData.config.voice}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Música:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formData.config.music}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Idioma:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formData.config.language === 'pt' ? 'Português' : 'Inglês'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('videoStudio.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('videoStudio.subtitle')}
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Content */}
      <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <CardContent sx={{ p: 4 }}>
          {activeStep === 0 && renderSceneStep()}
          {activeStep === 1 && renderConfigStep()}
          {activeStep === 2 && renderReviewStep()}

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              size="large"
            >
              Voltar
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  size="large"
                  startIcon={loading ? <LinearProgress /> : <PlayIcon />}
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                    },
                  }}
                >
                  {loading ? 'Criando...' : 'Criar Vídeo'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  size="large"
                >
                  Próximo
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VideoStudio; 