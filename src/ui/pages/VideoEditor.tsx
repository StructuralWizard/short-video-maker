import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  CardMedia,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { nanoid } from 'nanoid';

interface Scene {
  id: string;
  text: string;
  searchTerms: string[];
  duration: number;
  orientation: string;
  captions: any[];
  videos: string[];
  audio: {
    url: string;
    duration: number;
  };
}

interface VideoData {
  scenes: Scene[];
  config: any;
}

interface VideoSearchResult {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
}

const VideoEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [referenceAudioPath, setReferenceAudioPath] = useState<string>("");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const getPreviewUrl = (url: string, isSearchResult: boolean = false): string => {
    const path = url.replace(/https?:\/\/[^/]+/, '');
    const baseUrl = `/api/proxy${path}`;
    if (isSearchResult) {
      return `${baseUrl}?nocache=true`;
    }
    return baseUrl;
  };

  useEffect(() => {
    if (id) {
      loadVideoData();
    }
  }, [id]);

  const loadVideoData = async () => {
    try {
      console.log(`[VideoEditor] Loading data for ID: ${id}`);
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/video-data/${id}`);
      console.log('[VideoEditor] API Response:', response);
      
      const data = response.data;
      console.log('[VideoEditor] Data received:', data);

      if (!data) {
        throw new Error("API returned no data");
      }

      if (!data.scenes) {
        console.warn('[VideoEditor] No scenes found in data, initializing as empty array.');
        data.scenes = [];
      }
      if (!data.config) {
        console.warn('[VideoEditor] No config found in data, initializing as empty object.');
        data.config = {};
      }
      
      setVideoData(data);
      
      if (data.config && data.config.referenceAudioPath) {
        setReferenceAudioPath(data.config.referenceAudioPath);
      }
    } catch (err) {
      const errorMessage = `Failed to load video data for ID: ${id}`;
      console.error(errorMessage, err);
      if (axios.isAxiosError(err)) {
        console.error('Axios error details:', err.response?.data);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      console.log('[VideoEditor] Finished loading attempt.');
    }
  };

  const handleSearchVideos = async () => {
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    try {
      const response = await axios.get(`/api/search-videos?query=${encodeURIComponent(searchTerm)}&count=10`);
      setSearchResults(response.data.videos || []);
    } catch (err) {
      setError('Failed to search videos');
      console.error('Error searching videos:', err);
    } finally {
      setSearching(false);
    }
  };

  const saveVideoData = async (data: VideoData) => {
    if (!id) return;
    try {
      await axios.post(`/api/video-data/${id}`, data);
    } catch (err) {
      console.error("Failed to auto-save video data:", err);
      // Opcional: Adicionar um alerta para o usuário
    }
  };

  const handleReplaceVideo = (newVideo: VideoSearchResult) => {
    if (!videoData) return;

    const updatedData = { ...videoData };
    updatedData.scenes[currentSceneIndex].videos[currentVideoIndex] = newVideo.url;

    setVideoData(updatedData);
    saveVideoData(updatedData);

    setSearchDialogOpen(false);
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleSaveAndRender = async () => {
    if (!videoData || !id) return;

    setRendering(true);
    try {
      const payload = {
        id: id,
        scenes: videoData.scenes,
        config: {
          ...videoData.config,
          referenceAudioPath: referenceAudioPath,
        },
      };

      await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      navigate('/');
    } catch (err) {
      setError('Failed to save and render video');
      console.error('Error saving and rendering video:', err);
    } finally {
      setRendering(false);
    }
  };

  const openSearchDialog = (sceneIndex: number, videoIndex: number) => {
    setCurrentSceneIndex(sceneIndex);
    setCurrentVideoIndex(videoIndex);
    setSearchDialogOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSceneTextChange = (sceneIndex: number, newText: string) => {
    setVideoData(prevData => {
      if (!prevData) return null;
      const updatedScenes = [...prevData.scenes];
      updatedScenes[sceneIndex].text = newText;
      return { ...prevData, scenes: updatedScenes };
    });
  };

  const handlePlayAudio = (audioUrl: string) => {
    if (audioPlayerRef.current) {
      const player = audioPlayerRef.current;
      // Extract filename from the full URL and construct proxy URL
      const filename = audioUrl.split('/').pop();
      if (filename) {
        player.src = `/api/temp/${filename}`;
        player.play().catch(e => console.error("Error playing audio:", e));
      }
    }
  };

  const handleGenerateAudio = async (sceneIndex: number) => {
    if (!videoData) return;
    
    const scene = videoData.scenes[sceneIndex];
    const text = scene.text;

    setGeneratingAudio(prev => ({ ...prev, [sceneIndex]: true }));

    try {
      const response = await axios.post('/api/generate-tts', {
        text: text,
        videoId: id,
        sceneId: scene.id,
        voice: videoData.config.voice,
        language: videoData.config.language || 'pt',
        referenceAudioPath: referenceAudioPath,
        forceRegenerate: true,
      });

      const { audioUrl, duration, subtitles } = response.data;

      setGeneratingAudio(prev => ({ ...prev, [sceneIndex]: false }));

      handlePlayAudio(audioUrl);

      // Cria um novo objeto com os dados atualizados para garantir a consistência
      const updatedData: VideoData = {
        ...videoData,
        scenes: videoData.scenes.map((s, i) => {
          if (i === sceneIndex) {
            return {
              ...s,
              audio: { url: audioUrl, duration: duration },
              duration: duration,
              captions: subtitles,
            };
          }
          return s;
        }),
        config: videoData.config
      };

      // Atualiza o estado da UI e persiste os dados no servidor
      setVideoData(updatedData);
      saveVideoData(updatedData);

    } catch (err) {
      console.error("Failed to generate audio:", err);
      setError(`Failed to generate audio for scene ${sceneIndex + 1}`);
      setGeneratingAudio(prev => ({ ...prev, [sceneIndex]: false }));
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!videoData) {
    return <Alert severity="info">Loading video data...</Alert>;
  }

  return (
    <Box maxWidth="lg" mx="auto" py={4}>
      <audio ref={audioPlayerRef} hidden />
      <Box display="flex" alignItems="center" mb={3}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mr: 2 }}
        >
          Back to videos
        </Button>
        <Typography variant="h4" component="h1">
          Edit Video: {id?.substring(0, 8)}...
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Video Configuration</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={rendering ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSaveAndRender}
            disabled={rendering}
          >
            {rendering ? 'Rendering...' : 'Save & Re-render'}
          </Button>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Total Scenes
            </Typography>
            <Typography variant="body1">
              {videoData.scenes.length}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Total Duration
            </Typography>
            <Typography variant="body1">
              {formatDuration(videoData.scenes.reduce((acc, scene) => acc + scene.duration, 0))}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Reference Audio Path"
              variant="outlined"
              value={referenceAudioPath}
              onChange={(e) => setReferenceAudioPath(e.target.value)}
              placeholder="e.g., /path/to/your/audio.wav"
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        Scenes
      </Typography>

      {videoData.scenes.map((scene, sceneIndex) => (
        <Accordion key={scene.id} defaultExpanded={sceneIndex === 0} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Scene {sceneIndex + 1}
              </Typography>
              <Chip 
                label={`${formatDuration(scene.duration)}`} 
                size="small"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom>
                Scene Text & Audio
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  fullWidth
                  multiline
                  variant="outlined"
                  value={scene.text}
                  onChange={(e) => handleSceneTextChange(sceneIndex, e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                <IconButton onClick={() => handlePlayAudio(scene.audio.url)} title="Play current audio">
                  <PlayArrowIcon />
                </IconButton>
                <IconButton 
                  onClick={() => handleGenerateAudio(sceneIndex)} 
                  disabled={generatingAudio[sceneIndex]}
                  title="Generate new audio"
                >
                  {generatingAudio[sceneIndex] ? <CircularProgress size={24} /> : <GraphicEqIcon />}
                </IconButton>
              </Box>
            </Box>
            
            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" gutterBottom>
                Video Clips
            </Typography>
            <Grid container spacing={2}>
              {(scene.videos || []).map((videoUrl, videoIndex) => (
                <Grid item xs={12} sm={6} md={4} key={videoIndex}>
                  <Card sx={{ position: 'relative' }}>
                    <video
                      src={getPreviewUrl(videoUrl)}
                      muted
                      autoPlay
                      loop
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => console.error("Video error:", e)}
                    />
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      bottom={0}
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => openSearchDialog(sceneIndex, videoIndex)}
                      >
                        Replace
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}

      <Dialog 
        open={searchDialogOpen} 
        onClose={() => setSearchDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Search and Replace Video</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search for videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchVideos()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearchVideos} edge="end">
                    {searching ? <CircularProgress size={20} /> : <SearchIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <List sx={{ mt: 2 }}>
            {searching ? (
              <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>
            ) : searchResults.length > 0 ? (
              searchResults.map((video, index) => (
                <ListItem 
                  key={video.id || index}
                  button 
                  onClick={() => handleReplaceVideo(video)}
                  divider
                >
                  <Grid container alignItems="center">
                    <Grid item xs={8}>
                      <ListItemText 
                        primary={`Video ${index + 1}`}
                        secondary={`Duration: ${formatDuration(video.duration)}`}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <Card sx={{ width: '100%', height: 84, backgroundColor: '#000' }}>
                        <video
                          src={getPreviewUrl(video.url, true)}
                          height="84"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                          muted
                          autoPlay
                          loop
                        />
                      </Card>
                    </Grid>
                  </Grid>
                </ListItem>
              ))
            ) : (
              <Typography align="center" color="text.secondary" sx={{ py: 3 }}>
                No search results.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoEditor; 