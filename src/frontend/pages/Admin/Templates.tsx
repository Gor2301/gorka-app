// src/frontend/pages/Admin/Templates.tsx
import React, { useState } from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Template } from '@prisma/client';
import { TemplateList } from '../../components/Email/TemplateList';
import { TemplateEditor } from '../../components/Email/TemplateEditor';

export function TemplatesPage() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const handleSave = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Template Management
        </Typography>
        <Breadcrumbs aria-label="breadcrumb">
          <Link color="inherit" href="/admin">
            Admin
          </Link>
          <Typography color="text.primary">Templates</Typography>
        </Breadcrumbs>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage email, SMS, and WhatsApp templates for your communication channels.
          Use placeholders like {'{{debtor_name}}'} to personalize messages.
        </Typography>
      </Box>

      <TemplateList
        key={refreshKey}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onRefresh={handleSave}
      />

      <TemplateEditor
        open={editorOpen}
        template={selectedTemplate}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </Container>
  );
}