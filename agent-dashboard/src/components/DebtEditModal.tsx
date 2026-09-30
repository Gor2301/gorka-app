import { useState, useEffect } from 'react';
import { Modal, Button, Input, Label, Select, ErrorBanner } from './primitives';
import { localDB, Debt, DebtInput } from '@/services/local.db';
import './DebtEditModal.css';

export interface DebtEditModalProps {
  /** The debtor this debt belongs to. */
  debtorId: string;
  /** null = create mode. Otherwise the debt id being edited. */
  editingId: string | null;
  /** Existing debt values when editing. Ignored in create mode. */
  initial?: Debt | null;
  /** Called after a successful save (create or update). */
  onSaved: (debt: Debt) => void;
  /** Called when the user closes the modal without saving. */
  onClose: () => void;
}

const emptyForm = {
  amount: '',
  currency: 'USD',
  status: 'ACTIVE',
  due_date: '',
  description: '',
};

const STATUS_OPTIONS = ['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
const CURRENCY_OPTIONS = ['USD', 'PHP', 'EUR', 'GBP'] as const;

export default function DebtEditModal({
  debtorId,
  editingId,
  initial,
  onSaved,
  onClose,
}: DebtEditModalProps) {
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editingId && initial) {
      setForm({
        amount: String(initial.amount ?? ''),
        currency: initial.currency || 'USD',
        status: initial.status || 'ACTIVE',
        due_date: initial.due_date ? initial.due_date.substring(0, 10) : '',
        description: initial.description || '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setFormError('');
  }, [editingId, initial]);

  const handleSave = async () => {
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum < 0) {
      setFormError('Amount must be a non-negative number');
      return;
    }
    try {
      setSaving(true);
      setFormError('');
      const payload: DebtInput = {
        debtor_id: debtorId,
        amount: amountNum,
        currency: form.currency,
        status: form.status,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        description: form.description || null,
      };
      const saved = editingId
        ? await localDB.updateDebt(editingId, payload)
        : await localDB.insertDebt(payload);
      onSaved(saved);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to save debt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editingId ? 'Edit Debt' : 'Add Debt'}
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editingId ? 'Save Changes' : 'Create Debt'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="debt-edit-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}
      <div className="debt-edit-modal__fields">
        <div className="debt-edit-modal__row debt-edit-modal__row--amount">
          <div>
            <Label>Amount *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="debt-edit-modal__row debt-edit-modal__row--status">
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}