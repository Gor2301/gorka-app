// agent-dashboard/src/services/local.db.ts
//
// Transport adapter for the Agent App. Wraps the Rust commands
// registered in src-tauri-agent/src/main.rs.
//
// Thin adapter only. No validation, no error translation, no UI
// state, no logging. Errors bubble to the caller. organization_id
// is never sent; the Rust side derives it from the authenticated
// session.

import { invoke } from '@tauri-apps/api/core';

// --- Auth -----------------------------------------------------

export const auth = {
  async login(email: string, password: string): Promise<string> {
    return await invoke<string>('login', { email, password });
  },

  async getToken(): Promise<string> {
    return await invoke<string>('get_auth_token');
  },

  async getOrganizationId(): Promise<string> {
    return await invoke<string>('get_organization_id');
  },

  async isUnlocked(): Promise<boolean> {
    return await invoke<boolean>('is_database_unlocked');
  },

  async unlockDatabase(password: string): Promise<void> {
    await invoke('unlock_database', { password });
  },

  async logout(): Promise<void> {
    await invoke('logout');
  },
};

// --- Types ----------------------------------------------------

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

export interface Action {
  id: string;
  debtor_id: string;
  type: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  description: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface ActionInput {
  debtor_id: string;
  type: string;
  status?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  description?: string | null;
  data?: any;
}

// --- Local DB -------------------------------------------------

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