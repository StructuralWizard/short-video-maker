import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Avatar,
  Button,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  TrendingUp as TrendingIcon,
  AccessTime as TimeIcon,
  CloudDone as DoneIcon,
  PlayArrow as PlayIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  SmartToy as AIIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface DashboardStats {
  totalVideos: number;
  completedVideos: number;
  processingVideos: number;
  failedVideos: number;
  totalDuration: number;
  todayVideos: number;
}

interface RecentVideo {
  id: string;
  status: string;
  progress?: number;
  stage?: string;
  createdAt: string;
  scenes?: any[];
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    completedVideos: 0,
    processingVideos: 0,
    failedVideos: 0,
    totalDuration: 0,
    todayVideos: 0,
  });
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/videos');
      const videos = response.data;

      // Calculate stats
      const totalVideos = videos.length;
      const completedVideos = videos.filter((v: any) => v.status === 'ready').length;
      const processingVideos = videos.filter((v: any) => v.status === 'processing').length;
      const failedVideos = videos.filter((v: any) => v.status === 'failed').length;
      
      const today = new Date().toDateString();
      const todayVideos = videos.filter((v: any) => 
        new Date(v.createdAt || Date.now()).toDateString() === today
      ).length;

      setStats({
        totalVideos,
        completedVideos,
        processingVideos,
        failedVideos,
        totalDuration: 0, // TODO: Calculate based on video data
        todayVideos,
      });

      // Get recent videos (last 5)
      const recent = videos
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);
      setRecentVideos(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Previne navegação quando clica no delete
    
    if (!window.confirm('Tem certeza que deseja deletar este vídeo?')) {
      return;
    }

    try {
      setDeletingVideoId(videoId);
      await axios.delete(`/api/videos/${videoId}`);
      // Atualizar a lista após deletar
      await fetchDashboardData();
    } catch (error) {
      console.error('Error deleting video:', error);
      alert(t('errors.deleteVideoFailed'));
    } finally {
      setDeletingVideoId(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return theme.palette.success.main;
      case 'processing':
        return theme.palette.warning.main;
      case 'failed':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return t('dashboard.status.ready');
      case 'processing':
        return t('dashboard.status.processing');
      case 'failed':
        return t('dashboard.status.failed');
      case 'pending':
        return t('dashboard.status.pending');
      default:
        return t('dashboard.status.unknown');
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('dashboard.timeAgo.now');
    if (diffMins < 60) return t('dashboard.timeAgo.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('dashboard.timeAgo.hoursAgo', { count: diffHours });
    return t('dashboard.timeAgo.daysAgo', { count: diffDays });
  };

  const statCards = [
    {
      title: t('dashboard.stats.totalVideos'),
      value: stats.totalVideos,
      icon: <VideoIcon />,
      color: theme.palette.primary.main,
      gradient: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    },
    {
      title: t('dashboard.stats.completedVideos'),
      value: stats.completedVideos,
      icon: <DoneIcon />,
      color: theme.palette.success.main,
      gradient: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
    },
    {
      title: t('dashboard.stats.processingVideos'),
      value: stats.processingVideos,
      icon: <TrendingIcon />,
      color: theme.palette.warning.main,
      gradient: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
    },
    {
      title: t('dashboard.stats.completedVideos'),
      value: stats.todayVideos,
      icon: <TimeIcon />,
      color: theme.palette.secondary.main,
      gradient: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {t('dashboard.title')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={fetchDashboardData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => navigate('/studio')}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                },
              }}
            >
              {t('dashboard.createNewVideo')}
            </Button>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('dashboard.subtitle')}
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              elevation={0}
              sx={{
                background: card.gradient,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `radial-gradient(circle, ${alpha('#fff', 0.2)}, transparent)`,
                  borderRadius: '50%',
                  transform: 'translate(30px, -30px)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar
                    sx={{
                      backgroundColor: alpha('#fff', 0.2),
                      color: 'white',
                    }}
                  >
                    {card.icon}
                  </Avatar>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
                    {loading ? '...' : card.value}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {card.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: 'fit-content',
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.05)})`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('dashboard.quickActions')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => navigate('/studio')}
                sx={{ justifyContent: 'flex-start', py: 1.5 }}
              >
                {t('dashboard.createNewVideo')}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<AIIcon />}
                onClick={() => navigate('/ai-scripts')}
                sx={{ justifyContent: 'flex-start', py: 1.5 }}
              >
                {t('dashboard.generateAIScript')}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<VideoIcon />}
                onClick={() => navigate('/library')}
                sx={{ justifyContent: 'flex-start', py: 1.5 }}
              >
                {t('dashboard.goToLibrary')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Videos */}
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.05)})`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('dashboard.recentVideos')}
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <LinearProgress sx={{ width: '100%' }} />
              </Box>
            ) : recentVideos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <VideoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {t('dashboard.noVideos')}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/studio')}
                >
                  {t('dashboard.createNewVideo')}
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentVideos.map((video) => (
                  <Card
                    key={video.id}
                    elevation={0}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
                      },
                    }}
                    onClick={() => navigate(`/video/${video.id}`)}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                          <Avatar
                            sx={{
                              backgroundColor: alpha(getStatusColor(video.status), 0.2),
                              color: getStatusColor(video.status),
                            }}
                          >
                            <VideoIcon />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {t('library.video', { id: video.id.substring(0, 8) })}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatRelativeTime(video.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Chip
                            label={getStatusText(video.status)}
                            size="small"
                            sx={{
                              backgroundColor: alpha(getStatusColor(video.status), 0.2),
                              color: getStatusColor(video.status),
                              fontWeight: 600,
                            }}
                          />
                          {video.status === 'processing' && video.progress && (
                            <Box sx={{ minWidth: 60 }}>
                              <Typography variant="caption" color="text.secondary">
                                {video.progress}%
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {video.status === 'ready' && (
                              <IconButton size="small" color="primary">
                                <PlayIcon />
                              </IconButton>
                            )}
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => handleDeleteVideo(video.id, e)}
                              disabled={deletingVideoId === video.id}
                              sx={{
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                                }
                              }}
                            >
                              {deletingVideoId === video.id ? (
                                <CircularProgress size={16} color="error" />
                              ) : (
                                <DeleteIcon />
                              )}
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                      
                      {video.status === 'processing' && video.progress && (
                        <Box sx={{ mt: 2 }}>
                          <LinearProgress
                            variant="determinate"
                            value={video.progress}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: alpha(theme.palette.primary.main, 0.2),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                              },
                            }}
                          />
                          {video.stage && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {video.stage}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 