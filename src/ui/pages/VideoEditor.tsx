import React, { useState, useEffect } from 'react';
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
  const { videoId } = useParams<{ videoId: string }>();
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

  const getPreviewUrl = (url: string, isSearchResult: boolean = false): string => {
    const baseUrl = `/api/proxy?src=${url}`;
    if (isSearchResult) {
      return `${baseUrl}&nocache=true`;
    }
    return baseUrl;
  };

  useEffect(() => {
    if (videoId) {
      loadVideoData();
    }
  }, [videoId]);

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/video-data/${videoId}`);
      setVideoData(response.data);
    } catch (err) {
      setError('Failed to load video data');
      console.error('Error loading video data:', err);
    } finally {
      setLoading(false);
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

  const handleReplaceVideo = (newVideo: VideoSearchResult) => {
    if (!videoData) return;

    const updatedVideoData = { ...videoData };
    const scene = updatedVideoData.scenes[currentSceneIndex];
    
    // Substitui o vídeo na posição atual
    scene.videos[currentVideoIndex] = newVideo.url;
    
    setVideoData(updatedVideoData);
    setSearchDialogOpen(false);
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleSaveAndRender = async () => {
    if (!videoData || !videoId) return;

    setRendering(true);
    try {
      // Salva os dados atualizados
      await axios.put(`/api/video-data/${videoId}`, videoData);
      
      // Re-renderiza o vídeo
      await axios.post(`/api/re-render-video/${videoId}`);
      
      // Redireciona para a página de detalhes do vídeo
      navigate(`/video/${videoId}`);
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
    return <Alert severity="error">Video data not found</Alert>;
  }

  return (
    <Box maxWidth="lg" mx="auto" py={4}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mr: 2 }}
        >
          Back to videos
        </Button>
        <Typography variant="h4" component="h1">
          Edit Video: {videoId?.substring(0, 8)}...
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
        </Grid>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        Scenes
      </Typography>

      {videoData.scenes.map((scene, sceneIndex) => (
        <Accordion key={scene.id} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Scene {sceneIndex + 1}
              </Typography>
              <Chip 
                label={formatDuration(scene.duration)} 
                size="small" 
                sx={{ mr: 2 }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Text: {scene.text}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Search Terms: {scene.searchTerms.join(', ')}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Videos ({scene.videos.length})
                </Typography>
                <Grid container spacing={2}>
                  {scene.videos.map((videoUrl, videoIndex) => (
                    <Grid item xs={12} sm={6} md={4} key={videoIndex}>
                      <Card>
                        <video
                          src={getPreviewUrl(videoUrl)}
                          height="140"
                          style={{ width: '100%', objectFit: 'cover', background: '#000' }}
                          controls
                          muted
                          autoPlay
                          loop
                          playsInline
                        />
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">
                            Video {videoIndex + 1}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SearchIcon />}
                            onClick={() => openSearchDialog(sceneIndex, videoIndex)}
                            sx={{ mt: 1 }}
                          >
                            Replace
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Dialog para buscar e substituir vídeos */}
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