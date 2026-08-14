import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Avatar,
  Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

const API_BASE = 'http://localhost:3000';

interface Communication {
  id: string;
  channel: string;
  contactEmail: string;
  subject: string | null;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
}

interface Debtor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  messageLogs: Communication[];
  actions: any[];
  debts: any[];
}

const DebtorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No debtor ID provided');
      setLoading(false);
      return;
    }
    fetchDebtor(id);
  }, [id]);

  const fetchDebtor = async (debtorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/debtors/${debtorId}`);
      if (!response.ok) {
        throw new Error('Debtor not found');
      }
      const result = await response.json();
      setDebtor(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debtor');
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    const config: Record<string, { color: any; icon: React.ReactNode }> = {
      SENT: { color: 'success', icon: <CheckCircleIcon /> },
      FAILED: { color: 'error', icon: <ErrorIcon /> },
      PENDING: { color: 'warning', icon: <PendingIcon /> },
    };
    const { color, icon } = config[status] || { color: 'default', icon: null };
    return <Chip label={status} color={color} size="small" icon={icon || undefined} />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!debtor) {
    return (
      <Box p={3}>
        <Alert severity="warning">Debtor not found</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  const communicationCount = debtor.messageLogs?.length || 0;
  const sentCount = debtor.messageLogs?.filter((c) => c.status === 'SENT').length || 0;
  const pendingCount = debtor.messageLogs?.filter((c) => c.status === 'PENDING').length || 0;
  const failedCount = debtor.messageLogs?.filter((c) => c.status === 'FAILED').length || 0;

  return (
    <Box p={3}>
      {/* Header with back button */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Debtor Details</Typography>
      </Box>

      {/* Debtor Info Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                <PersonIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h5">{debtor.name}</Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2">{debtor.email}</Typography>
                  </Box>
                  {debtor.phone && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2">{debtor.phone}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box textAlign="right">
              <Chip
                label={debtor.status}
                color={debtor.status === 'ACTIVE' ? 'success' : 'default'}
                size="medium"
              />
              <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 1 }}>
                Created: {new Date(debtor.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Communications</Typography>
              <Typography variant="h4">{communicationCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Sent</Typography>
              <Typography variant="h4" color="success.main">{sentCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Pending</Typography>
              <Typography variant="h4" color="warning.main">{pendingCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Failed</Typography>
              <Typography variant="h4" color="error.main">{failedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Communication History */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Communication History</Typography>
        <Divider sx={{ mb: 2 }} />
        
        {debtor.messageLogs && debtor.messageLogs.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Channel</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {debtor.messageLogs.map((comm) => (
                  <TableRow key={comm.id} hover>
                    <TableCell>
                      <Chip label={comm.channel} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{comm.contactEmail}</TableCell>
                    <TableCell>{comm.subject || '-'}</TableCell>
                    <TableCell>{getStatusChip(comm.status)}</TableCell>
                    <TableCell>
                      {comm.sentAt ? new Date(comm.sentAt).toLocaleString() : new Date(comm.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="textSecondary">No communications found for this debtor.</Typography>
        )}
      </Paper>
    </Box>
  );
};

export default DebtorDetailPage;