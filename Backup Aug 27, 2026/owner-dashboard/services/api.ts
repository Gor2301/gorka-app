// src/owner-dashboard/services/api.ts
// API Service for Owner Dashboard

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================
// TYPES
// ============================================
export type ClientStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'ARCHIVED';
export type ClientPlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type ClientType = 'AGENCY' | 'BANK' | 'LAW_FIRM' | 'FINANCE';
export type SyncStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface Client {
  id: string;
  name: string;
  status: ClientStatus;
  plan: ClientPlan;
  totalDebtors: number;
  totalAgents: number;
  totalDebt: number;
  revenue?: number;
  lastSync?: string;
  type?: ClientType;
  registrationNumber?: string;
  taxId?: string;
  primaryContact?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  joinedDate?: string;
  renewalDate?: string;
  activeAgents?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  syncStatus?: SyncStatus;
  lastActive?: string;
  aiCalls?: number;
  emailsSent?: number;
  smsSent?: number;
  recoveryRate?: number;
  website?: string;
  billingEmail?: string;
  billingPhone?: string;
  verificationStatus?: string;
  emailVerifiedAt?: string;
  verifiedAt?: string;
  suspendedAt?: string;
  rejectedAt?: string;
  termsAcceptedAt?: string;
  verifiedBy?: string;
  suspendedBy?: string;
  reviewNotes?: string;
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalDebtors: number;
  totalDebt: number;
  monthlyRevenue: number;
  clientGrowth: number;
  revenueGrowth: number;
  debtorGrowth: number;
  debtGrowth: number;
}

// ============================================
// SUPPORT TYPES
// ============================================
export interface SupportTicket {
  id: string;
  ticketNumber: number;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    contactEmail: string | null;
    primaryContact: string | null;
  };
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  openedBy: string;
  openedByEmail: string;
  openedByName: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  previousAssignee: string | null;
  escalatedAt: string | null;
  escalatedBy: string | null;
  escalationReason: string | null;
  createdAt: string;
  updatedAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolvedBy: string | null;
  closedBy: string | null;
  isDeleted: boolean;
  replies?: TicketReply[];
  events?: TicketEvent[];
}

export interface TicketReply {
  id: string;
  ticketId: string;
  message: string;
  isInternal: boolean;
  sentBy: string;
  sentByName: string | null;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType: string;
  actorId: string;
  actorName: string | null;
  oldValue: any;
  newValue: any;
  createdAt: string;
}

export interface TicketStats {
  open: number;
  inProgress: number;
  waitingForClient: number;
  resolved: number;
  closed: number;
  total: number;
}

export interface TicketListResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// API HELPERS
// ============================================
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(options?.headers || {})
  };

  const url = `/api${endpoint}`;
  console.log(`🔑 Fetching: ${url}`);

  const response = await fetch(url, {
    ...options,
    headers
  });

  console.log(`📡 Response status: ${response.status}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Response data:`, data);
  return data;
}

// ============================================
// DASHBOARD APIs
// ============================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetchAPI<{ data: DashboardStats }>('/analytics/overview');
  return response.data;
}

// ============================================
// CLIENT APIs
// ============================================
export async function getClients(): Promise<Client[]> {
  const response = await fetchAPI<{ data: Client[] }>('/clients');
  return response.data;
}

export async function getClient(id: string): Promise<Client> {
  const response = await fetchAPI<{ data: Client }>(`/clients/${id}`);
  return response.data;
}

// ============================================
// CLIENT MANAGEMENT APIs (Owner Actions)
// ============================================
export async function verifyClient(id: string, notes?: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/clients/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' })
  });
  return response.data;
}

export async function suspendClient(id: string, reason: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/clients/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
  return response.data;
}

export async function rejectClient(id: string, reason: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/clients/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
  return response.data;
}

export async function reinstateClient(id: string, notes?: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/clients/${id}/reinstate`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' })
  });
  return response.data;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return response.data;
}

// ============================================
// SUPPORT APIs
// ============================================
export async function getTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
}): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.status) query.append('status', params.status);
  if (params?.priority) query.append('priority', params.priority);
  if (params?.search) query.append('search', params.search);
  
  const queryString = query.toString();
  const endpoint = queryString ? `/support/tickets?${queryString}` : '/support/tickets';
  const response = await fetchAPI<{ data: TicketListResponse }>(endpoint);
  return response.data;
}

export async function getTicketStats(): Promise<TicketStats> {
  const response = await fetchAPI<{ data: TicketStats }>('/support/tickets/stats');
  return response.data;
}

export async function getTicket(id: string): Promise<SupportTicket> {
  const response = await fetchAPI<{ data: SupportTicket }>(`/support/tickets/${id}`);
  return response.data;
}

export async function addTicketReply(ticketId: string, message: string, sentBy: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/support/tickets/${ticketId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message, sentBy })
  });
  return response.data;
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/support/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return response.data;
}

export async function assignTicket(ticketId: string, assignedTo: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/support/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo })
  });
  return response.data;
}

export async function escalateTicket(ticketId: string, escalationReason: string): Promise<any> {
  const response = await fetchAPI<{ data: any }>(`/support/tickets/${ticketId}/escalate`, {
    method: 'PATCH',
    body: JSON.stringify({ escalationReason })
  });
  return response.data;
}

// ============================================
// ANALYTICS APIs
// ============================================
export async function getUsageMetrics(): Promise<any> {
  const response = await fetchAPI<{ data: any }>('/analytics/usage');
  return response.data;
}

// ============================================
// BILLING APIs
// ============================================
export async function getBillingOverview(): Promise<any> {
  const response = await fetchAPI<{ data: any }>('/billing/revenue');
  return response.data;
}

// ============================================
// AUDIT APIs
// ============================================
export async function getAuditLogs(params?: { page?: number; limit?: number }): Promise<any> {
  const query = params ? `?page=${params.page || 1}&limit=${params.limit || 50}` : '';
  const response = await fetchAPI<{ data: any }>(`/audit${query}`);
  return response.data;
}

// ============================================
// SYSTEM STATUS APIs
// ============================================
export async function getSystemStatus(): Promise<any> {
  const response = await fetchAPI<{ data: any }>('/status');
  return response.data;
}