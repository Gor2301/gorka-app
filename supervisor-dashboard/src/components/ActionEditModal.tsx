import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { localDB, Action, ActionInput } from '../services/local.db';

export interface ActionEditModalProps {
  /** The debtor this action belongs to. */
  debtorId: string;
  /** null = create mode. Otherwise the action id being edited. */
  editingId: string | null;
  /** Existing action values when editing. Ignored in create mode. */
  initial?: Action | null;
  /** Called after a successful save (create or update). */
  onSaved: (action: Action) => void;
  /** Called when the user closes the modal without saving. */
  onClose: () => void;
}

const emptyForm = {
  type: 'CALL',
  status: 'PENDING',
  assigned_to: '',
  due_date: '',
  description: '',
};

const TYPE_OPTIONS = ['CALL', 'EMAIL', 'SMS', 'VISIT', 'LETTER', 'TASK', 'LEGAL'] as const;
const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const ActionEditModal: React.FC<ActionEditModalProps> = ({
  debtorId,
  editingId,
  initial,
  onSaved,
  onClose,
}) => {
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editingId && initial) {
      setForm({
        type: initial.type || 'CALL',
        status: initial.status || 'PENDING',
        assigned_to: initial.assigned_to || '',
        due_date: initial.due_date ? initial.due_date.substring(0, 10) : '',
        description: initial.description || '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setFormError('');
  }, [editingId, initial]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setFormError('');
      const payload: ActionInput = {
        debtor_id: debtorId,
        type: form.type,
        status: form.status,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        description: form.description || null,
      };
      const saved = editingId
        ? await localDB.updateAction(editingId, payload)
        : await localDB.insertAction(payload);
      onSaved(saved);
    } catch (err: any) {
      console.error('Save action failed:', err);
      setFormError(err?.message || 'Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  // ─── Styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '4px',
  };

  const btnPrimary: React.CSSProperties = {
    background: '#7C3AED',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  };

  const btnGhost: React.CSSProperties = {
    background: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      overflowY: 'auto', padding: '24px'
    }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
            {editingId ? 'Edit Action' : 'Add Action'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
            {formError}
          </div>
        )}

        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                style={inputStyle}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <input
                style={inputStyle}
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                placeholder="Leave empty for now"
              />
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input
                style={inputStyle}
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary} disabled={saving}>
            {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Action')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionEditModal;