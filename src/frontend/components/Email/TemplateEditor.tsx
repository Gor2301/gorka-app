// src/frontend/components/Email/TemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  Paper,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { Template } from '@prisma/client';

// ============================================
// FIX: API Base URL for Electron
// ============================================
const API_BASE = 'http://localhost:3000';

interface TemplateEditorProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSave: () => void;
}

export function TemplateEditor({ open, template, onClose, onSave }: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    channel: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH',
    subject: '',
    body: '',
    category: '',
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState(0);

  // Load template data when editing
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        channel: template.channel as any || 'EMAIL',
        subject: template.subject || '',
        body: template.body || '',
        category: template.category || '',
        status: template.status as any || 'DRAFT',
      });
    } else {
      setFormData({
        name: '',
        channel: 'EMAIL',
        subject: '',
        body: '',
        category: '',
        status: 'DRAFT',
      });
    }
    setError(null);
    setSuccess(null);
  }, [template, open]);

  // Handle save
  const handleSave = async () => {
    if (!formData.name || !formData.body) {
      setError('Name and body are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('authToken');
      const url = template 
        ? `${API_BASE}/api/templates/${template.id}`
        : `${API_BASE}/api/templates`;
      const method = template ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${template ? 'update' : 'create'} template`);
      }

      setSuccess(`Template ${template ? 'updated' : 'created'} successfully!`);
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  // Preview with placeholders
  const getPreview = () => {
    let previewBody = formData.body;
    // Replace common placeholders with sample data
    const placeholders: Record<string, string> = {
      '{{debtor_name}}': 'Juan Dela Cruz',
      '{{debtor_address}}': '123 Main St, Manila',
      '{{debtor_phone}}': '09123456789',
      '{{debtor_email}}': 'juan@example.com',
      '{{amount}}': '₱5,000.00',
      '{{due_date}}': 'December 31, 2024',
      '{{days_overdue}}': '15',
      '{{organization_name}}': 'GORKA Collections',
      '{{collector_name}}': 'Maria Santos',
      '{{collector_phone}}': '09123456789',
      '{{collector_email}}': 'maria@gorka.local',
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      previewBody = previewBody.replace(new RegExp(key, 'g'), value);
    });

    return previewBody;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {template ? 'Edit Template' : 'Create New Template'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Error/Success Alerts */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Template Name */}
          <TextField
            label="Template Name *"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Welcome Email, Payment Reminder"
          />

          {/* Channel and Category */}
          <Box display="flex" gap={2}>
            <FormControl fullWidth>
              <InputLabel>Channel *</InputLabel>
              <Select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                label="Channel *"
              >
                <MenuItem value="EMAIL">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                <MenuItem value="PUSH">Push Notification</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Category"
              fullWidth
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Welcome, Reminder, Payment"
            />
          </Box>

          {/* Subject (only for Email) */}
          {formData.channel === 'EMAIL' && (
            <TextField
              label="Subject"
              fullWidth
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject line"
            />
          )}

          {/* Body */}
          <TextField
            label="Template Body *"
            fullWidth
            multiline
            rows={8}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            placeholder={`Enter your template content here.
Use placeholders like {{debtor_name}}, {{amount}}, {{due_date}} to personalize messages.`}
            helperText="Use {{placeholders}} for dynamic content"
          />

          {/* Status */}
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              label="Status"
            >
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
              <MenuItem value="ARCHIVED">Archived</MenuItem>
            </Select>
          </FormControl>

          {/* Preview Section */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              <PreviewIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              Preview with Sample Data
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', minHeight: 100 }}>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
              >
                {formData.body ? getPreview() : 'Preview will appear here...'}
              </Typography>
            </Paper>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              <Chip label="{{debtor_name}}" size="small" variant="outlined" />
              <Chip label="{{amount}}" size="small" variant="outlined" />
              <Chip label="{{due_date}}" size="small" variant="outlined" />
              <Chip label="{{days_overdue}}" size="small" variant="outlined" />
              <Chip label="{{organization_name}}" size="small" variant="outlined" />
              <Chip label="{{collector_name}}" size="small" variant="outlined" />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : template ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TemplateEditor;