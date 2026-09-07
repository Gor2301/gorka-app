const API_URL = import.meta.env.VITE_API_URL || 'http://api.gorka.localhost:3000/api';

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  debtorsAssigned?: number;
  actionsCompleted?: number;
}

export const agentsService = {
  async getAgents(token: string): Promise<Agent[]> {
    const response = await fetch(`${API_URL}/users?role=AGENT`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch agents');
    }

    return response.json();
  }
};