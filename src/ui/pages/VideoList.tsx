import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress, 
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';

interface VideoItem {
  id: string;
  status: string;
}

const VideoList: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchVideos = async () => {
    try {
      const response = await axios.get('/api/short-videos');
      setVideos(response.data.videos || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch videos');
      setLoading(false);
      console.error('Error fetching videos:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleCreateNew = () => {
    navigate('/create');
  };

  const handleVideoClick = (id: string) => {
    navigate(`/video/${id}`);
  };

  const handleDeleteVideo = async (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    
    try {
      await axios.delete(`/api/short-video/${id}`);
      fetchVideos();
    } catch (err) {
      setError('Failed to delete video');
      console.error('Error deleting video:', err);
    }
  };

  const handleClearAllVideos = async () => {
    setClearing(true);
    try {
      // Fazer uma requisição para limpar todos os vídeos
      await axios.post('/api/clear-all-videos');
      setVideos([]);
      setClearDialogOpen(false);
    } catch (err) {
      setError('Failed to clear all videos');
      console.error('Error clearing videos:', err);
    } finally {
      setClearing(false);
    }
  };

  const capitalizeFirstLetter = (str: string) => {
    if (!str || typeof str !== 'string') return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" py={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Your Videos
        </Typography>
        <Box display="flex" gap={2}>
          {videos.length > 0 && (
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<ClearIcon />}
              onClick={() => setClearDialogOpen(true)}
            >
              Clear All
            </Button>
          )}
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
          >
            Create New Video
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}
      
      {videos.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            You haven't created any videos yet.
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
            sx={{ mt: 2 }}
          >
            Create Your First Video
          </Button>
        </Paper>
      ) : (
        <Paper>
          <List>
            {videos.map((video, index) => {
              const videoId = video?.id || '';
              const videoStatus = video?.status || 'unknown';
              
              return (
                <div key={videoId}>
                  {index > 0 && <Divider />}
                  <ListItem 
                    button 
                    onClick={() => handleVideoClick(videoId)}
                    sx={{ 
                      py: 2,
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    <ListItemText
                      primary={`Video ${videoId.substring(0, 8)}...`}
                      secondary={
                        <Typography
                          component="span"
                          variant="body2"
                          color={
                            videoStatus === 'ready' ? 'success.main' : 
                            videoStatus === 'processing' ? 'info.main' : 
                            videoStatus === 'failed' ? 'error.main' : 'text.secondary'
                          }
                        >
                          {capitalizeFirstLetter(videoStatus)}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      {videoStatus === 'ready' && (
                        <IconButton 
                          edge="end" 
                          aria-label="play"
                          onClick={() => handleVideoClick(videoId)}
                          color="primary"
                        >
                          <PlayArrowIcon />
                        </IconButton>
                      )}
                      <IconButton 
                        edge="end" 
                        aria-label="delete" 
                        onClick={(e) => handleDeleteVideo(videoId, e)}
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </div>
              );
            })}
          </List>
        </Paper>
      )}

      {/* Dialog de confirmação para limpar todos os vídeos */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Clear All Videos</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all {videos.length} videos? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)} disabled={clearing}>
            Cancel
          </Button>
          <Button 
            onClick={handleClearAllVideos} 
            color="error" 
            variant="contained"
            disabled={clearing}
            startIcon={clearing ? <CircularProgress size={16} /> : <ClearIcon />}
          >
            {clearing ? 'Clearing...' : 'Clear All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoList; 