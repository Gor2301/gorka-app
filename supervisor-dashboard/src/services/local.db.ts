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


// ─── TYPES ────────────────────────────────────────────────────────────
// Mirror of the Rust Debtor struct in src-tauri/src/main.rs.

export interface Debtor {
  id: string;
  organization_id: string;
  name: string;
  surname: string;
  email: string | null;
  phone: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface DebtorInput {
  name: string;
  surname: string;
  email?: string | null;
  phone?: string | null;
  data?: any;
}

// DASHBOARD TYPES
// Mirror of the Rust DashboardStats struct in src-tauri/src/main.rs.

export interface DashboardStats {
  total_debtors: number;
  total_debt: number;
  total_actions: number;
}

// ─── LOCAL DB (Debtor CRUD) ───────────────────────────────────────────
// Wraps the Rust commands registered in src-tauri/src/main.rs.
// organization_id is derived on the Rust side; the frontend never
// sends it.

export const localDB = {
  async getDebtors(): Promise<Debtor[]> {
    return await invoke<Debtor[]>('get_debtors');
  },

  async getDebtor(id: string): Promise<Debtor> {
    return await invoke<Debtor>('get_debtor', { id });
  },

  async insertDebtor(input: DebtorInput): Promise<Debtor> {
    return await invoke<Debtor>('insert_debtor', {
      input: {
        name: input.name,
        surname: input.surname,
        email: input.email ?? null,
        phone: input.phone ?? null,
        data: input.data ?? {},
      },
    });
  },

  async bulkInsertDebtors(inputs: DebtorInput[]): Promise<Debtor[]> {
    return await invoke<Debtor[]>('bulk_insert_debtors', {
      inputs: inputs.map((i) => ({
        name: i.name,
        surname: i.surname,
        email: i.email ?? null,
        phone: i.phone ?? null,
        data: i.data ?? {},
      })),
    });
  },

  async updateDebtor(id: string, input: DebtorInput): Promise<Debtor> {
    return await invoke<Debtor>('update_debtor', {
      id,
      input: {
        name: input.name,
        surname: input.surname,
        email: input.email ?? null,
        phone: input.phone ?? null,
        data: input.data ?? {},
      },
    });
  },

  async deleteDebtor(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_debtor', { id });
  },

  async searchDebtors(query: string): Promise<Debtor[]> {
    return await invoke<Debtor[]>('search_debtors', { query });
  },

  async getDebtorCount(): Promise<number> {
    return await invoke<number>('get_debtor_count');
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return await invoke<DashboardStats>('get_dashboard_stats');
  },

  async uploadDocument(input: DocumentInput): Promise<Document> {
    return await invoke<Document>('upload_document', { input });
  },

  async getDocuments(entityId: string, entityType?: string): Promise<Document[]> {
    return await invoke<Document[]>('get_documents', {
      entityId,
      entityType: entityType ?? null,
    });
  },

  async deleteDocument(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_document', { id });
  },

  async getDebts(debtorId: string): Promise<Debt[]> {
    return await invoke<Debt[]>('get_debts', { debtorId });
  },

  async insertDebt(input: DebtInput): Promise<Debt> {
    return await invoke<Debt>('insert_debt', {
      input: {
        debtor_id: input.debtor_id,
        amount: input.amount,
        currency: input.currency ?? null,
        status: input.status ?? null,
        due_date: input.due_date ?? null,
        description: input.description ?? null,
        data: input.data ?? null,
      },
    });
  },

  async updateDebt(id: string, input: DebtInput): Promise<Debt> {
    return await invoke<Debt>('update_debt', {
      id,
      input: {
        debtor_id: input.debtor_id,
        amount: input.amount,
        currency: input.currency ?? null,
        status: input.status ?? null,
        due_date: input.due_date ?? null,
        description: input.description ?? null,
        data: input.data ?? null,
      },
    });
  },

  async deleteDebt(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_debt', { id });
  },

  async getCommunications(debtorId: string): Promise<Communication[]> {
    return await invoke<Communication[]>('get_communications', { debtorId });
  },

  async insertCommunication(input: CommunicationInput): Promise<Communication> {
    return await invoke<Communication>('insert_communication', {
      input: {
        debtor_id: input.debtor_id,
        type: input.type,
        direction: input.direction,
        content: input.content ?? null,
        duration: input.duration ?? null,
        data: input.data ?? null,
      },
    });
  },

  async deleteCommunication(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_communication', { id });
  },

  async getActions(debtorId: string): Promise<Action[]> {
    return await invoke<Action[]>('get_actions', { debtorId });
  },

  async insertAction(input: ActionInput): Promise<Action> {
    return await invoke<Action>('insert_action', {
      input: {
        debtor_id: input.debtor_id,
        type: input.type,
        status: input.status ?? null,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        description: input.description ?? null,
        data: input.data ?? null,
      },
    });
  },

  async updateAction(id: string, input: ActionInput): Promise<Action> {
    return await invoke<Action>('update_action', {
      id,
      input: {
        debtor_id: input.debtor_id,
        type: input.type,
        status: input.status ?? null,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        description: input.description ?? null,
        data: input.data ?? null,
      },
    });
  },

  async deleteAction(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_action', { id });
  },

};



// ─── DOCUMENT TYPES ───────────────────────────────────────────────────
// Mirror of the Rust Document struct in src-tauri/src/main.rs.

export interface Document {
  id: string;
  entity_id: string;
  entity_type: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: string;
  description: string | null;
  uploaded_by: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface DocumentInput {
  entity_id: string;
  entity_type: string;
  file_name: string;
  file_content: number[];   // Tauri invoke serializes Uint8Array as number[]
  file_type: string;
  category: string;
  description?: string | null;
  uploaded_by?: string | null;
  is_primary?: boolean;
}


// ─── DEBT TYPES ───────────────────────────────────────────────────────
// Mirror of the Rust Debt struct in src-tauri/src/main.rs.

export interface Debt {
  id: string;
  debtor_id: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  description: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface DebtInput {
  debtor_id: string;
  amount: number;
  currency?: string;
  status?: string;
  due_date?: string | null;
  description?: string | null;
  data?: any;
}

// ─── COMMUNICATION TYPES ──────────────────────────────────────────────
// Mirror of the Rust Communication struct in src-tauri/src/main.rs.
// Note: the Rust field is `r#type`; Tauri serializes it as "type" on the
// JSON wire. The frontend always uses the key `type`.

export interface Communication {
  id: string;
  debtor_id: string;
  type: string;            // 'CALL' | 'EMAIL' | 'SMS' | 'NOTE'
  direction: string;       // 'INBOUND' | 'OUTBOUND'
  content: string | null;
  duration: number | null;
  created_by: string | null;
  data: any;
  created_at: string;
}

export interface CommunicationInput {
  debtor_id: string;
  type: string;            // 'CALL' | 'EMAIL' | 'SMS' | 'NOTE'
  direction: string;       // 'INBOUND' | 'OUTBOUND'
  content?: string | null;
  duration?: number | null;
  data?: any;
}

// ─── ACTION TYPES ─────────────────────────────────────────────────────
// Mirror of the Rust Action struct in src-tauri/src/main.rs.
// Note: the Rust field is `r#type`; Tauri serializes it as "type" on the
// JSON wire. The frontend always uses the key `type`.

export interface Action {
  id: string;
  debtor_id: string;
  type: string;            // 'CALL' | 'EMAIL' | 'SMS' | 'VISIT' | 'LETTER' | 'TASK' | 'LEGAL'
  status: string;          // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  assigned_to: string | null;
  due_date: string | null;
  description: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface ActionInput {
  debtor_id: string;
  type: string;            // 'CALL' | 'EMAIL' | 'SMS' | 'VISIT' | 'LETTER' | 'TASK' | 'LEGAL'
  status?: string;         // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  assigned_to?: string | null;
  due_date?: string | null;
  description?: string | null;
  data?: any;
}



