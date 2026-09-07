import { api } from './api.service';

export interface Connector {
  id: string;
  name: string;
  description?: string;
  type: 'EMAIL' | 'SMS' | 'VOICE' | 'DATA_SOURCE';
  category: 'INTERNAL' | 'EXTERNAL';
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastTestedAt?: string;
  acknowledged: boolean;
  hasCredentials: boolean;
}

export const connectorsService = {
  // ─── Get connectors from database ────────────────────────────────────
  async getConnectors(): Promise<Connector[]> {
    console.log('🔵 getConnectors called');
    try {
      const response = await api.get('/connectors');
      console.log('🟢 Full response:', response);
      console.log('🟢 response.data:', response.data);
      
      const connectors = response.data?.data || response.data || [];
      console.log('🟢 Connectors array:', connectors);
      return connectors;
    } catch (err) {
      console.error('🔴 getConnectors error:', err);
      throw err;
    }
  },

  // ─── Get connector types (hardcoded list) ────────────────────────────
  async getConnectorTypes(): Promise<any[]> {
    console.log('🔵 getConnectorTypes called');
    try {
      const response = await api.get('/connectors/types');
      console.log('🟢 Full response:', response);
      console.log('🟢 response.data:', response.data);
      console.log('🟢 response.data?.data:', response.data?.data);
      return response.data || [];
    } catch (err) {
      console.error('🔴 getConnectorTypes error:', err);
      throw err;
    }
  },

  // ─── Get single connector ─────────────────────────────────────────────
  async getConnector(id: string): Promise<Connector> {
    console.log('🔵 getConnector called for id:', id);
    const response = await api.get(`/connectors/${id}`);
    return response.data?.data || response.data || null;
  },

  // ─── Connect connector (with modal — for External API) ──────────────
  async connectConnector(id: string, data: {
    acknowledged: boolean;
    config: Record<string, any>;
    credentials: Record<string, any>;
  }): Promise<Connector> {
    console.log('🔵 connectConnector called for id:', id);
    const response = await api.post(`/connectors/${id}/connect`, data);
    return response.data?.data || response.data || null;
  },

  // ─── Auto-connect (for built-in connectors — uses .env) ─────────────
  async connectAuto(id: string): Promise<any> {
    console.log('🔵 connectAuto called for id:', id);
    try {
      const response = await api.post(`/connectors/${id}/connect-auto`);
      console.log('🟢 connectAuto response:', response);
      return response.data || { success: true };
    } catch (err: any) {
      console.error('🔴 connectAuto error:', err);
      return { 
        success: false, 
        error: err.message || 'Auto-connect failed' 
      };
    }
  },

  // ─── Test connector ────────────────────────────────────────────────────
  async testConnector(id: string): Promise<any> {
    console.log('🔵 testConnector called for id:', id);
    try {
      const response = await api.post(`/connectors/${id}/test`);
      console.log('🟢 testConnector response:', response);
      console.log('🟢 response.data:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('🔴 testConnector error:', err);
      return { 
        success: false, 
        message: err.message || 'Test failed' 
      };
    }
  },

  // ─── Disconnect connector ─────────────────────────────────────────────
  async disconnectConnector(id: string): Promise<Connector> {
    console.log('🔵 disconnectConnector called for id:', id);
    const response = await api.post(`/connectors/${id}/disconnect`);
    return response.data?.data || response.data || null;
  },
};