import { api } from './api.service';

export const auditService = {
  async getAuditLogs(page: number = 1, limit: number = 20, search: string = '') {
    try {
      // ─── DISABLED: Old localStorage auth check ────────────────────────────
      // const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
      // 
      // if (!token) {
      //   console.error('No token found in localStorage');
      //   throw new Error('No authentication token found. Please log in again.');
      // }
      // 
      // console.log('🔍 Fetching audit logs with token:', token.substring(0, 20) + '...');
      // ──────────────────────────────────────────────────────────────────────

      const response = await api.get(`/audit/logs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      
      console.log('📊 Audit logs response:', response);
      return response;
    } catch (error: any) {
      console.error('Audit service error:', error);
      
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('token')) {
        throw new Error('Your session has expired. Please log out and log in again.');
      }
      
      throw error;
    }
  },

  async getActions() {
    try {
      // ─── DISABLED: Old localStorage auth check ────────────────────────────
      // const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
      // if (!token) {
      //   throw new Error('No authentication token found');
      // }
      // ──────────────────────────────────────────────────────────────────────
      
      const response = await api.get('/audit/actions');
      return response;
    } catch (error: any) {
      console.error('Audit service error:', error);
      throw error;
    }
  },

  async exportCsv(search: string = '') {
    // ─── DISABLED: Old localStorage auth check ────────────────────────────
    // const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
    // if (!token) {
    //   throw new Error('No authentication token found');
    // }
    // ──────────────────────────────────────────────────────────────────────
    
    window.open(`http://api.gorka.localhost:3000/api/audit/export/csv?search=${encodeURIComponent(search)}`, '_blank');
  }
};