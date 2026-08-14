import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';

const API_BASE = 'http://localhost:3000';

interface Communication {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  provider: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  error: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  debtor: { name: string; email: string; phone: string } | null;
  events: Array<{ event: string; timestamp: string }>;
}

const CommunicationsPage: React.FC = () => {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [newComm, setNewComm] = useState({
    type: 'EMAIL',
    to: '',
    subject: '',
    body: '',
  });
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);

  // Prevent double submit
  const isSubmitting = useRef(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const commRes = await fetch(`${API_BASE}/api/communications`);
      if (!commRes.ok) throw new Error('Failed to fetch communications');
      const commData = await commRes.json();
      setCommunications(commData.data?.communications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSend = async () => {
    if (isSubmitting.current) {
      console.log('⏭️ Already submitting, skipping...');
      return;
    }

    if (!newComm.to || !newComm.body) {
      setSendError('To and Body are required');
      return;
    }

    isSubmitting.current = true;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/communications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [newComm.to],
          subject: newComm.subject || '',
          content: newComm.body,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSendSuccess(`Email sent! ID: ${result.communicationId || result.id}`);
        setNewComm({ type: 'EMAIL', to: '', subject: '', body: '' });
        
        setTimeout(() => {
          setOpenDialog(false);
          setSendSuccess(null);
          fetchData();
          isSubmitting.current = false;
        }, 1500);
      } else {
        setSendError(result.error || 'Failed to send');
        isSubmitting.current = false;
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Network error');
      isSubmitting.current = false;
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this communication?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/communications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Delete error:', err);
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

  const filtered = communications.filter(comm => {
    const matchesSearch =
      comm.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (comm.subject || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || comm.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Communications</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => {
              setNewComm({ type: 'EMAIL', to: '', subject: '', body: '' });
              setSendError(null);
              setSendSuccess(null);
              isSubmitting.current = false;
              setOpenDialog(true);
            }}
            sx={{ mr: 1 }}
          >
            Send Email
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          placeholder="Search by recipient or subject..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Channel</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sent At</TableCell>
              <TableCell>Events</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary" sx={{ py: 3 }}>
                    No communications found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((comm) => (
                <TableRow key={comm.id} hover>
                  <TableCell>
                    <Chip label={comm.channel} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{comm.recipient}</TableCell>
                  <TableCell>{comm.subject || '-'}</TableCell>
                  <TableCell>{getStatusChip(comm.status)}</TableCell>
                  <TableCell>
                    {comm.sentAt ? new Date(comm.sentAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      {comm.events?.slice(0, 3).map((e, i) => (
                        <Chip key={i} label={e.event} size="small" variant="outlined" />
                      ))}
                      {comm.events?.length > 3 && (
                        <Chip label={`+${comm.events.length - 3}`} size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedComm(comm);
                        setDetailOpen(true);
                      }}
                    >
                      <SearchIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(comm.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filtered.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Email</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {sendError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSendError(null)}>
                {sendError}
              </Alert>
            )}
            {sendSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSendSuccess(null)}>
                {sendSuccess}
              </Alert>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Channel</InputLabel>
              <Select
                value={newComm.type}
                onChange={(e) => setNewComm({ ...newComm, type: e.target.value })}
                label="Channel"
              >
                <MenuItem value="EMAIL">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="PUSH">Push</MenuItem>
                <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="To"
              value={newComm.to}
              onChange={(e) => setNewComm({ ...newComm, to: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="recipient@example.com"
            />

            <TextField
              fullWidth
              label="Subject"
              value={newComm.subject}
              onChange={(e) => setNewComm({ ...newComm, subject: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="Email subject"
            />

            <TextField
              fullWidth
              label="Body"
              multiline
              rows={6}
              value={newComm.body}
              onChange={(e) => setNewComm({ ...newComm, body: e.target.value })}
              placeholder="Enter your message here..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sending || !newComm.to || !newComm.body}
          >
            {sending ? <CircularProgress size={24} /> : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Communication Details</DialogTitle>
        <DialogContent>
          {selectedComm && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">ID</Typography>
                  <Typography variant="body2">{selectedComm.id}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Status</Typography>
                  <Box>{getStatusChip(selectedComm.status)}</Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Channel</Typography>
                  <Typography variant="body2">{selectedComm.channel}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Recipient</Typography>
                  <Typography variant="body2">{selectedComm.recipient}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Subject</Typography>
                  <Typography variant="body2">{selectedComm.subject || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Body</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 0.5, bgcolor: 'background.default' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedComm.content}
                    </Typography>
                  </Paper>
                </Grid>
                {selectedComm.error && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="error">Error</Typography>
                    <Typography variant="body2" color="error">{selectedComm.error}</Typography>
                  </Grid>
                )}
                {selectedComm.providerMessageId && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">Provider ID</Typography>
                    <Typography variant="body2">{selectedComm.providerMessageId}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Events</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={0.5}>
                    {selectedComm.events?.map((e, i) => (
                      <Chip
                        key={i}
                        label={`${e.event} - ${new Date(e.timestamp).toLocaleString()}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Created</Typography>
                  <Typography variant="body2">{new Date(selectedComm.createdAt).toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Sent</Typography>
                  <Typography variant="body2">
                    {selectedComm.sentAt ? new Date(selectedComm.sentAt).toLocaleString() : '-'}
                  </Typography>
                </Grid>
                {selectedComm.deliveredAt && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">Delivered</Typography>
                    <Typography variant="body2">{new Date(selectedComm.deliveredAt).toLocaleString()}</Typography>
                  </Grid>
                )}
                {selectedComm.openedAt && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">Opened</Typography>
                    <Typography variant="body2">{new Date(selectedComm.openedAt).toLocaleString()}</Typography>
                  </Grid>
                )}
                {selectedComm.clickedAt && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">Clicked</Typography>
                    <Typography variant="body2">{new Date(selectedComm.clickedAt).toLocaleString()}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CommunicationsPage;