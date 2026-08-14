// src/frontend/components/Email/TemplateList.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { Template } from '@prisma/client';

// ============================================
// FIX: API Base URL for Electron
// ============================================
const API_BASE = 'http://localhost:3000';

interface TemplateListProps {
  onCreate: () => void;
  onEdit: (template: Template) => void;
  onRefresh: () => void;
}

export function TemplateList({ onCreate, onEdit, onRefresh }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Fetch templates
  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }
      
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Delete template
  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/templates/${templateToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete template');
      }
      
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      fetchTemplates();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  // Filter templates
  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChannel = channelFilter === 'ALL' || template.channel === channelFilter;
      return matchesSearch && matchesChannel;
    });

  // Pagination
  const paginatedTemplates = filteredTemplates.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Get status chip
  const getStatusChip = (status: string) => {
    const colorMap: Record<string, any> = {
      ACTIVE: 'success',
      INACTIVE: 'default',
      DRAFT: 'warning',
      ARCHIVED: 'error',
    };
    return (
      <Chip
        label={status}
        size="small"
        color={colorMap[status] || 'default'}
        icon={status === 'ACTIVE' ? <CheckCircleIcon /> : <BlockIcon />}
      />
    );
  };

  // Get channel chip
  const getChannelChip = (channel: string) => {
    const colorMap: Record<string, any> = {
      EMAIL: 'primary',
      SMS: 'secondary',
      WHATSAPP: 'success',
      PUSH: 'info',
    };
    return (
      <Chip
        label={channel}
        size="small"
        variant="outlined"
        color={colorMap[channel] || 'default'}
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box display="flex" gap={1} flexWrap="wrap">
          <TextField
            placeholder="Search templates..."
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
            sx={{ width: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Channel</InputLabel>
            <Select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              label="Channel"
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="EMAIL">Email</MenuItem>
              <MenuItem value="SMS">SMS</MenuItem>
              <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
              <MenuItem value="PUSH">Push</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchTemplates();
              onRefresh();
            }}
            size="small"
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreate}
            size="small"
          >
            Create Template
          </Button>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Version</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    No templates found. Create your first template!
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {template.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{getChannelChip(template.channel)}</TableCell>
                  <TableCell>{template.subject || '-'}</TableCell>
                  <TableCell>{template.category || '-'}</TableCell>
                  <TableCell>{getStatusChip(template.status)}</TableCell>
                  <TableCell>v{template.version || 1}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(template)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setTemplateToDelete(template);
                        setDeleteDialogOpen(true);
                      }}
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
          count={filteredTemplates.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TemplateList;