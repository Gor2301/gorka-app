// src/frontend/api/templates.ts
import { Template } from '@prisma/client';

const API_BASE = '/api/templates';

export interface TemplateCreateData {
  name: string;
  channel: string;
  subject?: string;
  content: string;
  category?: string;
  description?: string;
}

export interface TemplateUpdateData {
  name?: string;
  subject?: string;
  content?: string;
  category?: string;
  description?: string;
  isActive?: boolean;
}

export async function getTemplates(): Promise<Template[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }
  return response.json();
}

export async function createTemplate(data: TemplateCreateData): Promise<Template> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  return response.json();
}

export async function updateTemplate(id: string, data: TemplateUpdateData): Promise<Template> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  return response.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete template');
  }
}