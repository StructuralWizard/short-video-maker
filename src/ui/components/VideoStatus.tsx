import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayArrow,
  Schedule,
} from '@mui/icons-material';
import axios from 'axios';

interface VideoStatusData {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string;
  progress?: number;
  stage?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
}

interface VideoStatusProps {
  videoId: string;
  onStatusChange?: (status: VideoStatusData) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success';
    case 'processing': return 'primary';
    case 'failed': return 'error';
    case 'pending': return 'warning';
    default: return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ready': return <CheckCircle />;
    case 'processing': return <PlayArrow />;
    case 'failed': return <Error />;
    case 'pending': return <HourglassEmpty />;
    default: return <Schedule />;
  }
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString();
};

export const VideoStatus: React.FC<VideoStatusProps> = ({
  videoId,
  onStatusChange,
  autoRefresh = true,
  refreshInterval = 2000,
}) => {
  const [status, setStatus] = useState<VideoStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`/api/status/${videoId}`);
      const newStatus = response.data;
      setStatus(newStatus);
      setError(null);
      onStatusChange?.(newStatus);
    } catch (err) {
      setError('Failed to fetch video status');
      console.error('Error fetching video status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [videoId, autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!status) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        No status information available
      </Alert>
    );
  }

  const getStageDescription = (stage?: string) => {
    switch (stage) {
      case 'Initializing': return 'Preparando ambiente de renderização...';
      case 'Processing frames': return 'Processando frames do vídeo...';
      case 'Encoding video': return 'Codificando vídeo final...';
      case 'Finalizing': return 'Finalizando renderização...';
      case 'Completed': return 'Renderização concluída!';
      default: return 'Processando...';
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {getStatusIcon(status.status)}
              <Typography variant="h6" component="div">
                Status: {status.status.toUpperCase()}
              </Typography>
              <Chip
                label={status.status}
                color={getStatusColor(status.status) as any}
                size="small"
              />
            </Box>
            
            {status.message && (
              <Typography variant="body2" color="text.secondary" mb={1}>
                {status.message}
              </Typography>
            )}

            {status.stage && (
              <Typography variant="body2" color="text.secondary">
                {getStageDescription(status.stage)}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            {status.progress !== undefined && (
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Progresso
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {status.progress}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={status.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            {status.estimatedTimeRemaining && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                Tempo estimado: {formatDuration(status.estimatedTimeRemaining)}
              </Typography>
            )}
          </Grid>
        </Grid>

        {(status.startedAt || status.completedAt) && (
          <Paper variant="outlined" sx={{ mt: 2, p: 1 }}>
            <Grid container spacing={2}>
              {status.startedAt && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Iniciado em:
                  </Typography>
                  <Typography variant="body2">
                    {formatTime(status.startedAt)}
                  </Typography>
                </Grid>
              )}
              {status.completedAt && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Concluído em:
                  </Typography>
                  <Typography variant="body2">
                    {formatTime(status.completedAt)}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}

        {status.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Erro:</strong> {status.error}
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}; 