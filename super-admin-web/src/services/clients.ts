const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1/admin';

export interface Client {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  createdAt: string;
  _count?: {
    users: number;
    debtors: number;
    actions: number;
  };
}

export interface ClientsResponse {
  success: boolean;
  data: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const clientsService = {
  async getClients(page: number = 1, limit: number = 50, search?: string): Promise<ClientsResponse> {
    const token = localStorage.getItem('super_admin_token');
    const url = new URL(`${API_URL}/clients`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('limit', limit.toString());
    if (search) {
      url.searchParams.append('search', search);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch clients');
    }

    return response.json();
  },

  async getClient(id: string): Promise<any> {
    const token = localStorage.getItem('super_admin_token');
    const response = await fetch(`${API_URL}/clients/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch client');
    }

    return response.json();
  },

  async updateClientStatus(id: string, status: string): Promise<any> {
    const token = localStorage.getItem('super_admin_token');
    const response = await fetch(`${API_URL}/clients/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error('Failed to update client status');
    }

    return response.json();
  }
};