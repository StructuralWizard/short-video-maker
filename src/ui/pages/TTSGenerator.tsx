import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';

interface GeneratedAudio {
  id: string;
  text: string;
  filename: string;
  duration: number;
  voice: string;
  language: string;
  createdAt: Date;
}

const TTSGenerator: React.FC = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('af_heart');
  const [language, setLanguage] = useState('pt');
  const [referenceAudioPath, setReferenceAudioPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingFilename, setCurrentPlayingFilename] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      setError('Por favor, insira um texto para gerar o áudio.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post('/api/generate-tts', {
        text: text.trim(),
        voice,
        language,
        referenceAudioPath: referenceAudioPath || undefined
      });

      const audioData = response.data;
      const newAudio: GeneratedAudio = {
        id: Date.now().toString(),
        text: text.trim(),
        filename: audioData.filename,
        duration: audioData.duration,
        voice,
        language,
        createdAt: new Date()
      };

      setGeneratedAudios(prev => [newAudio, ...prev]);
      setSuccess('Áudio gerado com sucesso!');
      setText('');
    } catch (err) {
      console.error('Erro ao gerar áudio:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Erro ao gerar áudio');
      } else {
        setError('Erro inesperado ao gerar áudio');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = (filename: string) => {
    if (audioPlayerRef.current) {
      const player = audioPlayerRef.current;
      
      // Se já está tocando o mesmo áudio, para
      if (isPlaying && currentPlayingFilename === filename) {
        player.pause();
        player.currentTime = 0;
        setIsPlaying(false);
        setCurrentPlayingFilename(null);
        return;
      }
      
      // Se está tocando outro áudio, para o atual primeiro
      if (isPlaying) {
        player.pause();
        player.currentTime = 0;
      }
      
      player.src = `/api/temp/${filename}`;
      setCurrentPlayingFilename(filename);
      setIsPlaying(true);
      
      player.play()
        .then(() => {
          // Adiciona listener para quando o áudio terminar
          player.onended = () => {
            setIsPlaying(false);
            setCurrentPlayingFilename(null);
          };
        })
        .catch(e => {
          console.error("Erro ao reproduzir áudio:", e);
          setIsPlaying(false);
          setCurrentPlayingFilename(null);
        });
    }
  };

  const handleDownloadAudio = (filename: string, text: string) => {
    const link = document.createElement('a');
    link.href = `/api/temp/${filename}`;
    link.download = `tts_${filename}`;
    link.click();
  };

  const handleDeleteAudio = (id: string) => {
    setGeneratedAudios(prev => prev.filter(audio => audio.id !== id));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box maxWidth="lg" mx="auto" py={4}>
      <audio ref={audioPlayerRef} hidden />
      
      <Typography variant="h4" component="h1" gutterBottom>
        Gerador de Áudio TTS
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Gere áudio a partir de texto usando o sistema de Text-to-Speech.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configurações de Geração
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Texto para gerar áudio"
              variant="outlined"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite o texto que deseja converter em áudio..."
              disabled={loading}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Idioma</InputLabel>
              <Select
                value={language}
                label="Idioma"
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="pt">Português</MenuItem>
                <MenuItem value="en">Inglês</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Voz</InputLabel>
              <Select
                value={voice}
                label="Voz"
                onChange={(e) => setVoice(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="af_heart">Heart (Feminina)</MenuItem>
                <MenuItem value="af_alloy">Alloy (Feminina)</MenuItem>
                <MenuItem value="af_nova">Nova (Feminina)</MenuItem>
                <MenuItem value="am_echo">Echo (Masculina)</MenuItem>
                <MenuItem value="am_onyx">Onyx (Masculina)</MenuItem>
                <MenuItem value="am_liam">Liam (Masculina)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Caminho do Áudio de Referência (opcional)"
              variant="outlined"
              value={referenceAudioPath}
              onChange={(e) => setReferenceAudioPath(e.target.value)}
              placeholder="ex: /caminho/para/audio-referencia.wav"
              disabled={loading}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateAudio}
              disabled={loading || !text.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {loading ? 'Gerando...' : 'Gerar Áudio'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {generatedAudios.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Áudios Gerados
          </Typography>
          
          <List>
            {generatedAudios.map((audio, index) => (
              <React.Fragment key={audio.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" noWrap>
                        {audio.text.length > 50 ? `${audio.text.substring(0, 50)}...` : audio.text}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Duração: {formatDuration(audio.duration)} | 
                          Idioma: {audio.language === 'pt' ? 'Português' : 'Inglês'} | 
                          Voz: {audio.voice}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Gerado em: {audio.createdAt.toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handlePlayAudio(audio.filename)}
                      title={isPlaying && currentPlayingFilename === audio.filename ? "Parar áudio" : "Reproduzir áudio"}
                      color={isPlaying && currentPlayingFilename === audio.filename ? "secondary" : "default"}
                    >
                      {isPlaying && currentPlayingFilename === audio.filename ? (
                        <StopIcon />
                      ) : (
                        <PlayArrowIcon />
                      )}
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDownloadAudio(audio.filename, audio.text)}
                      title="Baixar áudio"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteAudio(audio.id)}
                      title="Remover da lista"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < generatedAudios.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default TTSGenerator; 