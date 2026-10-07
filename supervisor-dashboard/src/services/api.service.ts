import { invoke } from '@tauri-apps/api/core';

const API_URL = import.meta.env.VITE_API_URL || 'http://api.gorka.localhost:3000/api';

async function getToken(): Promise<string | null> {
  try {
    const token = await invoke<string>('get_auth_token');
    return token || null;
  } catch {
    return null;
  }
}

async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
): Promise<T> {
  const token = await getToken();
  const response = await fetch(API_URL + endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error('API Error: ' + response.status + ' ' + response.statusText);
  }

  return response.json();
}

export const api = {
  get<T = any>(endpoint: string): Promise<T> {
    return request<T>('GET', endpoint);
  },
  post<T = any>(endpoint: string, data?: any): Promise<T> {
    return request<T>('POST', endpoint, data);
  },
  put<T = any>(endpoint: string, data?: any): Promise<T> {
    return request<T>('PUT', endpoint, data);
  },
  delete<T = any>(endpoint: string): Promise<T> {
    return request<T>('DELETE', endpoint);
  },
};

export const apiService = api;