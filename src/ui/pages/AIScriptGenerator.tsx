import React, { useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Grid,
  Chip,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  CircularProgress,
  Fade,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import { AutoAwesome, ContentCopy, Download, ExpandMore, Lightbulb, VideoCall, Edit, Save, Close } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

interface ScriptMetadata {
  type: string;
  topic: string;
  style: string;
  duration: string;
  aiProvider: string;
  generatedAt: string;
  totalScenes: number;
  estimatedDuration: number;
  warning?: string;
  error?: string;
}

interface ScriptResponse {
  script: string;
  metadata: ScriptMetadata;
}

const AIScriptGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('general');
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [duration, setDuration] = useState('30-60 seconds');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedScript, setGeneratedScript] = useState<any>(null);
  const [metadata, setMetadata] = useState<ScriptMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Video creation options
  const [selectedVoice, setSelectedVoice] = useState('Paulo');
  const [selectedMusic, setSelectedMusic] = useState('happy');
  const [selectedOverlay, setSelectedOverlay] = useState('');
  const [orientation, setOrientation] = useState('portrait');

  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState<any>(null);

  const scriptTypes = [
    { value: 'marketing', label: 'Marketing & Sales' },
    { value: 'productivity', label: 'Productivity & Self-Improvement' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'finance', label: 'Finance & Business' },
    { value: 'general', label: 'General Content' }
  ];

  const durations = [
    '15-30 seconds',
    '30-60 seconds',
    '60-90 seconds',
    '90-120 seconds'
  ];

  const styleOptions = [
    'Professional and engaging',
    'Casual and conversational',
    'Educational and authoritative',
    'Energetic and motivational',
    'Storytelling and narrative',
    'Humorous and entertaining'
  ];

  const voiceOptions = [
    { value: 'Paulo', label: 'Paulo (Português)' },
    { value: 'Noel', label: 'Noel (Português)' },
    { value: 'Scarlett', label: 'Scarlett (English)' },
    { value: 'NinoCoelho', label: 'NinoCoelho (Português)' }
  ];

  const musicOptions = [
    { value: 'happy', label: 'Alegre' },
    { value: 'sad', label: 'Triste' },
    { value: 'excited', label: 'Animado' },
    { value: 'chill', label: 'Relaxante' },
    { value: 'inspirational', label: 'Inspiracional' },
    { value: 'cinematic', label: 'Cinematográfico' },
    { value: 'worship', label: 'Adoração' }
  ];

  const overlayOptions = [
    { value: '', label: 'Nenhum' },
    { value: 'jornada', label: 'Jornada' },
    { value: 'jornada_landscape', label: 'Jornada Landscape' },
    { value: 'jornada_laranja', label: 'Jornada Laranja' },
    { value: 'whatsappbanner', label: 'WhatsApp Banner' }
  ];

  const promptTemplates = [
    {
      name: 'Marketing Hook',
      prompt: 'Create a powerful marketing script that grabs attention in the first 3 seconds and drives action'
    },
    {
      name: 'Educational Explainer',
      prompt: 'Explain this complex topic in simple terms that anyone can understand'
    },
    {
      name: 'Problem-Solution',
      prompt: 'Identify a common problem and present a clear, actionable solution'
    },
    {
      name: 'Inspirational Story',
      prompt: 'Tell an inspiring story that motivates viewers to take action'
    }
  ];

  const generateScript = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic for your script');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const requestBody = {
        type,
        topic: topic.trim(),
        style: style || undefined,
        duration,
        customPrompt: customPrompt.trim() || undefined
      };

      const response = await fetch('/api/generate-ai-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: ScriptResponse = await response.json();
      
      setGeneratedScript(data.script);
      setMetadata(data.metadata);
      
      if (data.metadata.warning) {
        setError(data.metadata.warning);
      } else {
        setSuccess(`Script gerado com sucesso usando ${data.metadata.aiProvider}! 
          ${data.metadata.totalScenes} cenas, ~${data.metadata.estimatedDuration}s de duração estimada.`);
      }

    } catch (err) {
      console.error('Error generating script:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      let textToCopy = '';
      
      if (generatedScript?.scenes) {
        // Format structured script for copying
        textToCopy = `${generatedScript.title || 'Script Gerado'}\n\n`;
        if (generatedScript.description) {
          textToCopy += `${generatedScript.description}\n\n`;
        }
        
        generatedScript.scenes.forEach((scene: any, index: number) => {
          textToCopy += `Cena ${scene.sceneNumber || index + 1} (${scene.duration || '5s'}):\n`;
          textToCopy += `${scene.text}\n`;
          if (scene.visualSuggestion) {
            textToCopy += `Visual: ${scene.visualSuggestion}\n`;
          }
          if (scene.searchKeywords && scene.searchKeywords.length > 0) {
            textToCopy += `Palavras-chave: ${scene.searchKeywords.join(', ')}\n`;
          }
          textToCopy += '\n';
        });
      } else {
        textToCopy = typeof generatedScript === 'string' ? generatedScript : JSON.stringify(generatedScript, null, 2);
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setSuccess('Script copiado para a área de transferência!');
    } catch (err) {
      setError('Falha ao copiar o script');
    }
  };

  const downloadScript = () => {
    const element = document.createElement('a');
    const scriptText = typeof generatedScript === 'string' ? generatedScript : JSON.stringify(generatedScript, null, 2);
    const file = new Blob([scriptText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `script-${metadata?.topic || 'generated'}-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setSuccess('Script baixado com sucesso!');
  };

  // Editing functions
  const startEditing = (fieldId: string) => {
    setEditingField(fieldId);
    setEditedScript(JSON.parse(JSON.stringify(generatedScript))); // Deep clone
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditedScript(null);
  };

  const saveEdit = () => {
    setGeneratedScript(editedScript);
    setEditingField(null);
    setEditedScript(null);
    setSuccess('Script atualizado com sucesso!');
  };

  const updateEditedScript = (path: (string | number)[], value: any) => {
    if (!editedScript) return;
    
    const updated = JSON.parse(JSON.stringify(editedScript));
    let current = updated;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setEditedScript(updated);
  };

  const createVideoFromScript = async () => {
    if (!generatedScript || !metadata) {
      setError('Nenhum script gerado para criar vídeo');
      return;
    }

    setCreatingVideo(true);
    setError('');
    setSuccess('');

    try {
      console.log('Creating video from script:', {
        script: generatedScript,
        voice: selectedVoice,
        music: selectedMusic,
        overlay: selectedOverlay,
        orientation: orientation
      });

      // Enviar para a API de criação de vídeo a partir de script
      const response = await fetch('/api/create-video-from-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: generatedScript,
          voiceConfig: {
            voice: selectedVoice,
            language: 'pt',
            orientation: orientation,
            music: selectedMusic,
            overlay: selectedOverlay
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.videoId) {
        setSuccess(`✅ Vídeo ${result.videoId} adicionado à fila de processamento! Você pode acompanhar o progresso na Biblioteca ou Dashboard.`);
        
        // Limpar o formulário para permitir criar outro vídeo
        setTimeout(() => {
          setGeneratedScript(null);
          setMetadata(null);
        }, 3000);
      } else {
        throw new Error(result.error || 'Falha ao criar vídeo');
      }

    } catch (err) {
      console.error('Error creating video:', err);
      setError(err instanceof Error ? err.message : 'Falha ao criar vídeo');
    } finally {
      setCreatingVideo(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(45deg, #6366f1, #f59e0b)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}>
          <AutoAwesome sx={{ mr: 2, color: '#6366f1' }} />
          AI Script Generator
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Crie scripts envolventes para seus vídeos com inteligência artificial
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Formulário de Geração */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            height: 'fit-content',
            background: alpha('#6366f1', 0.02),
            border: `1px solid ${alpha('#6366f1', 0.1)}`
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Lightbulb sx={{ mr: 1, color: '#f59e0b' }} />
                Configuração do Script
              </Typography>

              <Box component="form" sx={{ mt: 2 }}>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Tipo de Script</InputLabel>
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    label="Tipo de Script"
                  >
                    {scriptTypes.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Tópico do Vídeo"
                  placeholder="Ex: Como aumentar produtividade trabalhando de casa"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                />

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Estilo</InputLabel>
                  <Select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    label="Estilo"
                  >
                    <MenuItem value="">
                      <em>Padrão</em>
                    </MenuItem>
                    {styleOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Duração</InputLabel>
                  <Select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    label="Duração"
                  >
                    {durations.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Accordion sx={{ mb: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Prompt Personalizado (Opcional)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      placeholder="Descreva instruções específicas para o seu script..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Templates Rápidos:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {promptTemplates.map((template) => (
                        <Chip
                          key={template.name}
                          label={template.name}
                          onClick={() => setCustomPrompt(template.prompt)}
                          variant="outlined"
                          size="small"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                <Accordion sx={{ mb: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Configurações do Vídeo (Opcional)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Voz</InputLabel>
                          <Select
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            label="Voz"
                          >
                            {voiceOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Música</InputLabel>
                          <Select
                            value={selectedMusic}
                            onChange={(e) => setSelectedMusic(e.target.value)}
                            label="Música"
                          >
                            {musicOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Overlay</InputLabel>
                          <Select
                            value={selectedOverlay}
                            onChange={(e) => setSelectedOverlay(e.target.value)}
                            label="Overlay"
                          >
                            {overlayOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel>Orientação</InputLabel>
                          <Select
                            value={orientation}
                            onChange={(e) => setOrientation(e.target.value)}
                            label="Orientação"
                          >
                            <MenuItem value="portrait">Vertical (9:16)</MenuItem>
                            <MenuItem value="landscape">Horizontal (16:9)</MenuItem>
                            <MenuItem value="square">Quadrado (1:1)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={generateScript}
                  disabled={loading || !topic.trim()}
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5b21b6, #7c3aed)',
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Gerando Script...
                    </>
                  ) : (
                    <>
                      <AutoAwesome sx={{ mr: 1 }} />
                      Gerar Script com IA
                    </>
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Resultado */}
        <Grid item xs={12} md={6}>
          {(error || success) && (
            <Alert 
              severity={error ? "error" : "success"} 
              sx={{ mb: 3 }}
              onClose={() => { setError(''); setSuccess(''); }}
            >
              {error || success}
            </Alert>
          )}

          {generatedScript && (
            <Fade in={true}>
              <Card sx={{ 
                background: alpha('#10b981', 0.02),
                border: `1px solid ${alpha('#10b981', 0.1)}`
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Script Gerado
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        onClick={copyToClipboard}
                        startIcon={<ContentCopy />}
                        variant="outlined"
                      >
                        Copiar
                      </Button>
                      <Button
                        size="small"
                        onClick={downloadScript}
                        startIcon={<Download />}
                        variant="outlined"
                      >
                        Baixar
                      </Button>
                      <Button
                        size="small"
                        onClick={createVideoFromScript}
                        startIcon={creatingVideo ? <CircularProgress size={16} /> : <VideoCall />}
                        variant="contained"
                        disabled={creatingVideo}
                        sx={{
                          background: 'linear-gradient(45deg, #10b981, #059669)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #059669, #047857)',
                          }
                        }}
                      >
                        {creatingVideo ? 'Criando...' : 'Criar Vídeo'}
                      </Button>
                    </Box>
                  </Box>

                  {metadata && (
                    <Paper sx={{ p: 2, mb: 2, bgcolor: alpha('#6366f1', 0.05) }}>
                      <Grid container spacing={2} sx={{ fontSize: '0.875rem' }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Provedor IA:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {metadata.aiProvider}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Cenas:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {metadata.totalScenes}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Duração estimada:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            ~{metadata.estimatedDuration}s
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Tipo:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {scriptTypes.find(t => t.value === metadata.type)?.label || metadata.type}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  )}

                  {/* Display structured script */}
                  {generatedScript?.scenes ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Video Title and Description */}
                      {generatedScript.title && (
                        <Paper sx={{ p: 2, bgcolor: alpha('#6366f1', 0.1), border: '1px solid ' + alpha('#6366f1', 0.3) }}>
                          <Typography variant="h6" gutterBottom>{generatedScript.title}</Typography>
                          {generatedScript.description && (
                            <Typography variant="body2" color="text.secondary">
                              {generatedScript.description}
                            </Typography>
                          )}
                        </Paper>
                      )}
                      
                      {/* Scenes */}
                      {(editedScript || generatedScript).scenes.map((scene: any, index: number) => {
                        const isEditingText = editingField === `scene-${index}-text`;
                        const isEditingKeywords = editingField === `scene-${index}-keywords`;
                        const displayScript = editedScript || generatedScript;
                        
                        return (
                          <Paper 
                            key={index}
                            sx={{ 
                              p: 3, 
                              bgcolor: '#1a1a1a',
                              border: '1px solid #333',
                              position: 'relative'
                            }}
                          >
                            {/* Edit buttons */}
                            {(isEditingText || isEditingKeywords) && (
                              <Box sx={{ 
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                display: 'flex',
                                gap: 1
                              }}>
                                <Tooltip title="Salvar">
                                  <IconButton 
                                    size="small"
                                    onClick={saveEdit}
                                    sx={{ 
                                      bgcolor: alpha('#10b981', 0.2),
                                      color: '#10b981',
                                      '&:hover': { bgcolor: alpha('#10b981', 0.3) }
                                    }}
                                  >
                                    <Save fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancelar">
                                  <IconButton 
                                    size="small"
                                    onClick={cancelEditing}
                                    sx={{ 
                                      bgcolor: alpha('#ef4444', 0.2),
                                      color: '#ef4444',
                                      '&:hover': { bgcolor: alpha('#ef4444', 0.3) }
                                    }}
                                  >
                                    <Close fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography variant="h6" sx={{ color: '#10b981' }}>
                                Cena {scene.sceneNumber || index + 1}
                              </Typography>
                              <Chip 
                                label={scene.duration || '5s'} 
                                size="small" 
                                sx={{ bgcolor: alpha('#f59e0b', 0.2), color: '#f59e0b' }}
                              />
                            </Box>
                            
                            {/* Editable Text */}
                            <Box sx={{ mb: 2 }}>
                              {isEditingText ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  value={displayScript.scenes[index].text}
                                  onChange={(e) => updateEditedScript(['scenes', index, 'text'], e.target.value)}
                                  variant="outlined"
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      color: '#e5e5e5',
                                      '& fieldset': { borderColor: '#10b981' },
                                      '&:hover fieldset': { borderColor: '#10b981' },
                                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                                    }
                                  }}
                                />
                              ) : (
                                <Typography 
                                  variant="body1" 
                                  onClick={() => startEditing(`scene-${index}-text`)}
                                  sx={{ 
                                    color: '#e5e5e5',
                                    fontWeight: 500,
                                    lineHeight: 1.6,
                                    cursor: 'pointer',
                                    p: 1,
                                    borderRadius: 1,
                                    '&:hover': {
                                      bgcolor: alpha('#10b981', 0.1),
                                      border: '1px dashed #10b981'
                                    }
                                  }}
                                >
                                  {scene.text}
                                  <Edit sx={{ ml: 1, fontSize: 16, opacity: 0.5 }} />
                                </Typography>
                              )}
                            </Box>
                            
                            {scene.visualSuggestion && (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  Sugestão Visual:
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                                  {scene.visualSuggestion}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Editable Keywords */}
                            {scene.searchKeywords && scene.searchKeywords.length > 0 && (
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                                  Palavras-chave para vídeos de fundo:
                                </Typography>
                                {isEditingKeywords ? (
                                  <TextField
                                    fullWidth
                                    value={displayScript.scenes[index].searchKeywords.join(', ')}
                                    onChange={(e) => {
                                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0);
                                      updateEditedScript(['scenes', index, 'searchKeywords'], keywords);
                                    }}
                                    placeholder="palavra1, palavra2, palavra3..."
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        color: '#e5e5e5',
                                        '& fieldset': { borderColor: '#6366f1' },
                                        '&:hover fieldset': { borderColor: '#6366f1' },
                                        '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                                      }
                                    }}
                                  />
                                ) : (
                                  <Box 
                                    onClick={() => startEditing(`scene-${index}-keywords`)}
                                    sx={{ 
                                      display: 'flex', 
                                      flexWrap: 'wrap', 
                                      gap: 0.5,
                                      p: 1,
                                      borderRadius: 1,
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: alpha('#6366f1', 0.1),
                                        border: '1px dashed #6366f1'
                                      }
                                    }}
                                  >
                                    {scene.searchKeywords.map((keyword: string, keyIndex: number) => (
                                      <Chip 
                                        key={keyIndex}
                                        label={keyword}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                          borderColor: alpha('#6366f1', 0.5),
                                          color: '#6366f1'
                                        }}
                                      />
                                    ))}
                                    <Edit sx={{ ml: 1, fontSize: 16, opacity: 0.5, color: '#6366f1' }} />
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  ) : (
                    // Fallback for non-structured scripts
                    <Paper sx={{ 
                      p: 3, 
                      bgcolor: '#1a1a1a',
                      border: '1px solid #333',
                      maxHeight: '400px',
                      overflow: 'auto'
                    }}>
                      <Typography 
                        variant="body1" 
                        component="pre" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          color: '#e5e5e5',
                          lineHeight: 1.6,
                          margin: 0
                        }}
                      >
                        {typeof generatedScript === 'string' ? generatedScript : JSON.stringify(generatedScript, null, 2)}
                      </Typography>
                    </Paper>
                  )}
                </CardContent>
              </Card>
            </Fade>
          )}

          {!generatedScript && !loading && (
            <Card sx={{ 
              background: alpha('#6b7280', 0.05),
              border: `1px dashed ${alpha('#6b7280', 0.3)}`,
              textAlign: 'center'
            }}>
              <CardContent sx={{ py: 6 }}>
                <AutoAwesome sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Seu script aparecerá aqui
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure os parâmetros e clique em "Gerar Script com IA"
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default AIScriptGenerator; 