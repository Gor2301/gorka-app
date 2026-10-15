import { api } from './api.service';

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'CLIENT' | 'AGENT';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface InviteAgentInput {
  email: string;
  name?: string;
  tempPassword: string;
}

export const usersService = {
  async listUsers(): Promise<UserRow[]> {
    const body = await api.get<any>('/users');
    return body?.data ?? [];
  },

  async inviteAgent(input: InviteAgentInput): Promise<UserRow> {
    const body = await api.post<any>('/users/invite-agent', input);
    return body?.data;
  },
};