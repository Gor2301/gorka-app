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
  async getConnectors(): Promise<Connector[]> {
    console.log('🔵 getConnectors called');
    try {
      console.log('🔵 Making API call to /connectors...');
      const response = await api.get('/connectors');
      console.log('🟢 Full response:', response);
      console.log('🟢 response.data:', response.data);
      console.log('🟢 response.data?.data:', response.data?.data);
      
      const connectors = response.data?.data || response.data || [];
      console.log('🟢 Connectors array:', connectors);
      return connectors;
    } catch (err) {
      console.error('🔴 getConnectors error:', err);
      throw err;
    }
  },

  async getConnector(id: string): Promise<Connector> {
    console.log('🔵 getConnector called for id:', id);
    const response = await api.get(`/connectors/${id}`);
    return response.data?.data || response.data || null;
  },

  async connectConnector(id: string, data: {
    acknowledged: boolean;
    config: Record<string, any>;
    credentials: Record<string, any>;
  }): Promise<Connector> {
    console.log('🔵 connectConnector called for id:', id);
    const response = await api.post(`/connectors/${id}/connect`, data);
    return response.data?.data || response.data || null;
  },

  async testConnector(id: string): Promise<any> {
    console.log('🔵 testConnector called for id:', id);
    try {
      const response = await api.post(`/connectors/${id}/test`);
      console.log('🟢 testConnector response:', response);
      console.log('🟢 response.data:', response.data);
      console.log('🟢 response.data.success:', response.data?.success);
      return response.data;
    } catch (err: any) {
      console.error('🔴 testConnector error:', err);
      return { 
        success: false, 
        message: err.message || 'Test failed' 
      };
    }
  },

  async disconnectConnector(id: string): Promise<Connector> {
    console.log('🔵 disconnectConnector called for id:', id);
    const response = await api.post(`/connectors/${id}/disconnect`);
    return response.data?.data || response.data || null;
  },
};