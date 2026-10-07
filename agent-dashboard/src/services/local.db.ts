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

export interface ActionWithDebtor {
  id: string;
  debtor_id: string;
  debtor_name: string;
  debtor_surname: string;
  type: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  description: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  debtor_id: string;
  type: string;
  direction: string;
  content: string | null;
  duration: number | null;
  created_by: string | null;
  data: any;
  created_at: string;
}

export interface CommunicationInput {
  debtor_id: string;
  type: string;
  direction: string;
  content?: string | null;
  duration?: number | null;
  data?: any;
}

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
  file_content: number[];
  file_type: string;
  category: string;
  description?: string | null;
  uploaded_by?: string | null;
  is_primary?: boolean;
}

export interface DebtorPhotoData {
  bytes: number[];
  mime: string;
}

export interface DebtorRelation {
  id: string;
  organization_id: string;
  debtor_id: string;
  related_debtor_id: string;
  relation_type: string;
  created_at: string;
  related_name: string;
  related_surname: string;
  related_email: string | null;
  related_phone: string | null;
  related_role: string;
}

export interface DebtorRelationInput {
  debtor_id: string;
  related_debtor_id: string;
  relation_type: string;
}

export interface RelatedDebtorRole {
  debtor_id: string;
  relation_type: string;
}

export interface DebtorDebtTotal {
  debtor_id: string;
  currency: string;
  total_amount: number;
}

export interface PrimaryDebtorRelation {
  debtor_id: string;
  relation_type: string;
}

export interface CalendarEvent {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  event_type: string;
  debtor_id: string | null;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  debtor_id?: string | null;
  data?: any;
}

export interface UpcomingPayment {
  debt_id: string;
  debtor_id: string;
  debtor_name: string;
  debtor_surname: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
}

export interface UpcomingFollowup {
  action_id: string;
  debtor_id: string;
  debtor_name: string;
  debtor_surname: string;
  type: string;
  status: string;
  due_date: string;
}

export interface LocalConnector {
  connector_code: string;
  tier: string;
  status: string;
  configuration: string;
  source_device_id: string;
  updated_at: string;
}

// --- Local DB ---

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

  async getAllActions(): Promise<ActionWithDebtor[]> {
    return await invoke<ActionWithDebtor[]>('get_all_actions');
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

  async getDocuments(
    entityId: string,
    entityType?: string,
  ): Promise<Document[]> {
    return await invoke<Document[]>('get_documents', {
      entityId,
      entityType: entityType ?? null,
    });
  },

  async uploadDocument(input: DocumentInput): Promise<Document> {
    return await invoke<Document>('upload_document', { input });
  },

  async deleteDocument(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_document', { id });
  },

  async setDebtorPhoto(
    debtorId: string,
    sourceFilePath: string,
  ): Promise<void> {
    await invoke('set_debtor_photo', {
      debtorId,
      sourceFilePath,
    });
  },

  async readDebtorPhoto(
    debtorId: string,
  ): Promise<DebtorPhotoData | null> {
    return await invoke<DebtorPhotoData | null>('read_debtor_photo', {
      debtorId,
    });
  },

  async getDebtorRelations(debtorId: string): Promise<DebtorRelation[]> {
    return await invoke<DebtorRelation[]>('get_debtor_relations', { debtorId });
  },

  async insertDebtorRelation(input: DebtorRelationInput): Promise<DebtorRelation> {
    return await invoke<DebtorRelation>('insert_debtor_relation', { input });
  },

  async deleteDebtorRelation(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_debtor_relation', { id });
  },

  async getRelatedDebtorRoles(): Promise<RelatedDebtorRole[]> {
    return await invoke<RelatedDebtorRole[]>('get_related_debtor_roles');
  },

  async getDebtorDebtTotals(): Promise<DebtorDebtTotal[]> {
    return await invoke<DebtorDebtTotal[]>('get_debtor_debt_totals');
  },

  async insertRelatedDebtor(
    input: DebtorInput,
    role: string,
  ): Promise<Debtor> {
    return await invoke<Debtor>('insert_related_debtor', {
      input: {
        name: input.name,
        surname: input.surname,
        email: input.email ?? null,
        phone: input.phone ?? null,
        data: input.data ?? {},
      },
      role,
    });
  },

  async cleanupOrphanedRelatedDebtors(): Promise<number> {
    return await invoke<number>('cleanup_orphaned_related_debtors');
  },

  async getPrimaryDebtors(): Promise<Debtor[]> {
    return await invoke<Debtor[]>('get_primary_debtors');
  },

  async searchPrimaryDebtors(query: string): Promise<Debtor[]> {
    return await invoke<Debtor[]>('search_primary_debtors', { query });
  },

  async getPrimaryDebtorRelations(): Promise<PrimaryDebtorRelation[]> {
    return await invoke<PrimaryDebtorRelation[]>('get_primary_debtor_relations');
  },

  async getCalendarEvents(
    startDate: string,
    endDate: string,
  ): Promise<CalendarEvent[]> {
    return await invoke<CalendarEvent[]>('get_calendar_events', {
      startDate,
      endDate,
    });
  },

  async insertCalendarEvent(
    input: CalendarEventInput,
  ): Promise<CalendarEvent> {
    return await invoke<CalendarEvent>('insert_calendar_event', {
      input: {
        title: input.title,
        description: input.description ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        all_day: input.all_day ?? null,
        debtor_id: input.debtor_id ?? null,
        data: input.data ?? null,
      },
    });
  },

  async updateCalendarEvent(
    id: string,
    input: CalendarEventInput,
  ): Promise<CalendarEvent> {
    return await invoke<CalendarEvent>('update_calendar_event', {
      id,
      input: {
        title: input.title,
        description: input.description ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        all_day: input.all_day ?? null,
        debtor_id: input.debtor_id ?? null,
        data: input.data ?? null,
      },
    });
  },

  async deleteCalendarEvent(id: string): Promise<boolean> {
    return await invoke<boolean>('delete_calendar_event', { id });
  },

  async getUpcomingPayments(
    startDate: string,
    endDate: string,
  ): Promise<UpcomingPayment[]> {
    return await invoke<UpcomingPayment[]>('get_upcoming_payments', {
      startDate,
      endDate,
    });
  },

  async getUpcomingFollowups(
    startDate: string,
    endDate: string,
  ): Promise<UpcomingFollowup[]> {
    return await invoke<UpcomingFollowup[]>('get_upcoming_followups', {
      startDate,
      endDate,
    });
  },

  // --- Connectors --------------------------------------------------

  async listLocalConnectors(): Promise<LocalConnector[]> {
    return await invoke<LocalConnector[]>('list_local_connectors');
  },

  // --- Sync engine -------------------------------------------------

  async syncEngineStatus(): Promise<string> {
    return await invoke<string>('sync_engine_status');
  },
};