// src/services/upload.service.ts
//
// Local-only upload service. Parses CSV in the browser, then writes
// to the local SQLCipher database via localDB (Tauri invoke).
// No cloud calls. No token required. No debtor data leaves the machine.

import { localDB, DebtorInput } from './local.db';

export interface UploadResponse {
  success: boolean;
  message: string;
  count?: number;
  errors?: string[];
}

// ─── CSV Parser ───────────────────────────────────────────────────────
// Produces rows shaped for localDB.insertDebtor / bulkInsertDebtors.
// Recognizes common header variants.

function parseCsv(text: string): { rows: DebtorInput[]; errors: string[] } {
  const errors: string[] = [];
  const rows: DebtorInput[] = [];

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV file must have at least a header row and one data row'] };
  }

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';')) delimiter = ';';

  const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());

  const pick = (row: Record<string, string>, ...keys: string[]): string => {
    for (const k of keys) {
      const v = row[k.toLowerCase()];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Name + surname detection.
    let name = pick(row, 'name', 'first name', 'first', 'firstname', 'first_name');
    let surname = pick(row, 'surname', 'last name', 'last', 'lastname', 'last_name');

    // Fallback: a single "Name" column holding "John Smith".
    if (!surname && name.includes(' ')) {
      const parts = name.split(/\s+/);
      name = parts[0];
      surname = parts.slice(1).join(' ');
    }

    if (!name) {
      errors.push(`Row ${i}: skipped - no name column matched`);
      continue;
    }
    if (!surname) {
      surname = '-';
    }

    const email = pick(row, 'email', 'e-mail', 'email address') || undefined;
    const phone = pick(row, 'phone', 'phone number', 'mobile', 'telephone') || undefined;
    const address = pick(row, 'address', 'street address', 'full address') || undefined;

    // Debt amount is stashed in data, since it is not a debtor field
    // in the local schema. A separate Debts table would carry it.
    const debtRaw = pick(row, 'total debt', 'total_debt', 'debt', 'total', 'amount');
    const totalDebt = debtRaw ? parseFloat(debtRaw.replace(/[$,]/g, '')) || 0 : 0;

    rows.push({
      name,
      surname,
      email,
      phone,
      data: {
        address: address || undefined,
        totalDebt: totalDebt || undefined,
        status: 'ACTIVE',
      },
    });
  }

  return { rows, errors };
}

// ─── Service ──────────────────────────────────────────────────────────
export const uploadService = {
  async uploadStructuredData(_token: string, file: File, dataType: string): Promise<UploadResponse> {
    // _token retained in signature for backward compatibility with
    // Upload.tsx. It is not used. Debtor data never leaves the machine.
    if (dataType !== 'csv' && !file.name.toLowerCase().endsWith('.csv')) {
      return {
        success: false,
        message: 'Only CSV files are supported currently',
        errors: ['JSON, Excel, and XML support coming soon'],
      };
    }

    const text = await file.text();
    const { rows, errors } = parseCsv(text);

    if (rows.length === 0) {
      return {
        success: false,
        message: 'No valid debtors found in file',
        errors: errors.length ? errors : ['No parsable rows found'],
      };
    }

    try {
      const inserted = await localDB.bulkInsertDebtors(rows);
      return {
        success: true,
        message: `Imported ${inserted.length} debtor(s) into the local database.`,
        count: inserted.length,
        errors: errors.length ? errors : undefined,
      };
    } catch (err: any) {
      console.error('Local bulk insert failed:', err);
      return {
        success: false,
        message: err?.message || 'Local bulk insert failed',
        errors: [err?.message || 'unknown error'],
      };
    }
  },

  async uploadUnstructuredData(_token: string, _file: File, _documentType: string): Promise<UploadResponse> {
    // Unstructured upload (PDF, images, text, email) is not implemented
    // in the desktop app yet. Nothing is uploaded anywhere.
    return {
      success: false,
      message: 'Unstructured upload is not yet available in the desktop app',
      errors: ['PDF, image, text, and email parsing is planned for a later phase'],
    };
  },
};