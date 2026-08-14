import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  register: (data: any) => ipcRenderer.invoke('auth-register', data),
  login: (data: any) => ipcRenderer.invoke('auth-login', data),
  verifyToken: (token: string) => ipcRenderer.invoke('auth-verify', { token }),
  getMe: (token: string) => ipcRenderer.invoke('auth-me', { token }),

  // Clipboard
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard-write', text),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),

  // Database operations
  dbTest: () => ipcRenderer.invoke('db-test'),
  getDebtors: (token: string) => ipcRenderer.invoke('get-debtors', { token }),
  getActions: (token: string) => ipcRenderer.invoke('get-actions', { token }),
  addDebtor: (token: string, data: any) => ipcRenderer.invoke('add-debtor', { token, debtorData: data }),
  updateAction: (token: string, id: string, data: any) => ipcRenderer.invoke('update-action', { token, id, data }),
  importDebtors: (token: string, fileContent: any, fileType: string) => ipcRenderer.invoke('import-debtors', { token, fileContent, fileType }),
  uploadAttachment: (token: string, data: any) => ipcRenderer.invoke('upload-attachment', { token, ...data }),
  getAttachments: (token: string, debtorId: string) => ipcRenderer.invoke('get-attachments', { token, debtorId }),
  deleteAttachment: (token: string, attachmentId: string) => ipcRenderer.invoke('delete-attachment', { token, attachmentId }),

  // Compliance
  getAuditLog: (token: string, limit?: number, offset?: number) => ipcRenderer.invoke('compliance-get-audit-log', { token, limit, offset }),
  addAuditLog: (token: string, action: string, details?: string) => ipcRenderer.invoke('compliance-add-audit-log', { token, action, details }),
  getComplianceRules: (token: string) => ipcRenderer.invoke('compliance-get-rules', { token }),
  getDataLocation: (token: string) => ipcRenderer.invoke('compliance-data-location', { token }),

  // AI Copilot
  aiActionSuggestion: (token: string, debtors: any[]) => ipcRenderer.invoke('ai-action-suggestion', { token, debtors }),
  aiEmailDraft: (token: string, debtor: any, templateType?: string) => ipcRenderer.invoke('ai-email-draft', { token, debtor, templateType }),
  aiSummary: (token: string, debtor: any) => ipcRenderer.invoke('ai-summary', { token, debtor }),
  aiNegotiationScript: (token: string, debtor: any) => ipcRenderer.invoke('ai-negotiation-script', { token, debtor }),
  aiCustom: (token: string, prompt: string, debtors: any[]) => ipcRenderer.invoke('ai-custom', { token, prompt, debtors }),

  // Skip Tracing
  skipGetContacts: (token: string, debtorId: string) => ipcRenderer.invoke('skip-get-contacts', { token, debtorId }),
  skipAddContact: (token: string, data: any) => ipcRenderer.invoke('skip-add-contact', { token, ...data }),
  skipDeleteContact: (token: string, contactId: string) => ipcRenderer.invoke('skip-delete-contact', { token, contactId }),
  skipSearch: (token: string, query: string) => ipcRenderer.invoke('skip-search', { token, query }),
  skipVerifyContact: (token: string, contactId: string) => ipcRenderer.invoke('skip-verify-contact', { token, contactId }),

  // Export
  exportDebtorsCSV: (token: string) => ipcRenderer.invoke('export-debtors-csv', { token }),
  exportDebtorsJSON: (token: string) => ipcRenderer.invoke('export-debtors-json', { token }),
  exportAuditLog: (token: string) => ipcRenderer.invoke('export-audit-log', { token }),

  // Analytics
  getDashboardAnalytics: (token: string) => ipcRenderer.invoke('analytics-get-dashboard', { token }),
  getDebtorAnalytics: (token: string) => ipcRenderer.invoke('analytics-get-debtors', { token }),
  getCollectionAnalytics: (token: string) => ipcRenderer.invoke('analytics-get-collections', { token }),

  // User Management (Admin)
  adminGetUsers: (token: string) => ipcRenderer.invoke('admin-get-users', { token }),
  adminAddUser: (token: string, email: string, name: string, role: string) => ipcRenderer.invoke('admin-add-user', { token, email, name, role }),
  adminUpdateUser: (token: string, userId: string, name: string, role: string) => ipcRenderer.invoke('admin-update-user', { token, userId, name, role }),
  adminResetPassword: (token: string, userId: string) => ipcRenderer.invoke('admin-reset-password', { token, userId }),
  adminDeleteUser: (token: string, userId: string) => ipcRenderer.invoke('admin-delete-user', { token, userId }),

  // Socket.io
  connectSocket: (url: string) => ipcRenderer.invoke('connect-socket', url),
  onDebtorAdded: (callback: (data: any) => void) => {
    ipcRenderer.on('debtor-added', (event, data) => callback(data));
  },
  onDebtorChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('debtor-changed', (event, data) => callback(data));
  },
  onActionChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('action-changed', (event, data) => callback(data));
  },
  onAttachmentUploaded: (callback: (data: any) => void) => {
    ipcRenderer.on('attachment-uploaded', (event, data) => callback(data));
  },
  onAttachmentDeleted: (callback: (data: any) => void) => {
    ipcRenderer.on('attachment-deleted', (event, data) => callback(data));
  },
  onContactAdded: (callback: (data: any) => void) => {
    ipcRenderer.on('contact-added', (event, data) => callback(data));
  },
  onContactDeleted: (callback: (data: any) => void) => {
    ipcRenderer.on('contact-deleted', (event, data) => callback(data));
  },
  onUserAdded: (callback: (data: any) => void) => {
    ipcRenderer.on('user-added', (event, data) => callback(data));
  },
  onUserUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('user-updated', (event, data) => callback(data));
  },
  onUserDeleted: (callback: (data: any) => void) => {
    ipcRenderer.on('user-deleted', (event, data) => callback(data));
  }
});