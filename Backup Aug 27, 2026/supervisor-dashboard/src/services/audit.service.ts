import { api } from './api.service';

export const auditService = {
  async getAuditLogs(page: number = 1, limit: number = 20, search: string = '') {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
      
      if (!token) {
        console.error('No token found in localStorage');
        throw new Error('No authentication token found. Please log in again.');
      }

      console.log('🔍 Fetching audit logs with token:', token.substring(0, 20) + '...');
      
      // Use the api service which handles adding the Authorization header
      const response = await api.get(`/audit/logs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      
      console.log('📊 Audit logs response:', response);
      return response;
    } catch (error: any) {
      console.error('Audit service error:', error);
      
      // If the error is 401 or 403, it's a token issue
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('token')) {
        throw new Error('Your session has expired. Please log out and log in again.');
      }
      
      throw error;
    }
  },

  async getActions() {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await api.get('/audit/actions');
      return response;
    } catch (error: any) {
      console.error('Audit service error:', error);
      throw error;
    }
  },

  async exportCsv(search: string = '') {
    const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    window.open(`http://127.0.0.1:3000/api/audit/export/csv?search=${encodeURIComponent(search)}&token=${token}`, '_blank');
  }
};