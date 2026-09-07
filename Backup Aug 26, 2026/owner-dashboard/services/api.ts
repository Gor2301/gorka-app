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
  totalDebt: number;        // ← NEW: Total debt sum for this client
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
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalDebtors: number;
  totalDebt: number;        // ← NEW: Total debt across all clients
  monthlyRevenue: number;
  clientGrowth: number;
  revenueGrowth: number;
  debtorGrowth: number;
  debtGrowth: number;       // ← NEW: Debt growth percentage
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
// CLIENT MANAGEMENT APIs (Owner Actions)  <-- ADD THIS SECTION
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
// ANALYTICS APIs      <-- KEEP THIS SECTION
// ============================================




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