// src/services/local.db.ts

import { invoke } from '@tauri-apps/api/core';

console.log('✅ invoke loaded:', typeof invoke);

export const auth = {
  async login(email: string, password: string): Promise<string> {
    console.log('🔑 [FRONTEND] login called');
    try {
      const result = await invoke<string>('login', { email, password });
      console.log('✅ [FRONTEND] login result:', result ? 'token received' : 'empty');
      return result;
    } catch (err) {
      console.error('❌ [FRONTEND] login error:', err);
      throw err;
    }
  },

  async getToken(): Promise<string | null> {
    console.log('🔍 [FRONTEND] getToken called');
    try {
      const token = await invoke<string>('get_auth_token');
      console.log('✅ [FRONTEND] getToken result:', token ? 'token received' : 'empty');
      return token;
    } catch (error) {
      console.error('🔴 [FRONTEND] getToken failed with:', error);
      return null;
    }
  },

  async getOrganizationId(): Promise<string | null> {
    console.log('🔍 [FRONTEND] getOrganizationId called');
    try {
      return await invoke<string>('get_organization_id');
    } catch {
      return null;
    }
  },

async getSalt(): Promise<string | null> {
  try {
    return await invoke<string>('get_salt');
  } catch {
    return null;
  }
},

  async isUnlocked(): Promise<boolean> {
    console.log('🔍 [FRONTEND] isUnlocked called');
    try {
      return await invoke<boolean>('is_database_unlocked');
    } catch {
      return false;
    }
  },

  async unlockDatabase(password: string): Promise<void> {
    console.log('🔑 [FRONTEND] unlockDatabase called');
    await invoke('unlock_database', { password });
  },

  async logout(): Promise<void> {
    console.log('🔑 [FRONTEND] logout called');
    await invoke('logout');
  },
};