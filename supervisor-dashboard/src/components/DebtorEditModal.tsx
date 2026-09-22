import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { localDB, Debtor, DebtorInput } from '../services/local.db';

const emptyForm: DebtorInput = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  data: {},
};

export interface DebtorEditModalProps {
  /** null = create mode. Otherwise the debtor id being edited. */
  editingId: string | null;
  /** Existing debtor values when editing. Ignored in create mode. */
  initial?: Debtor | null;
  /** Called after a successful save (create or update). */
  onSaved: (debtor: Debtor) => void;
  /** Called when the user closes the modal without saving. */
  onClose: () => void;
}

const DebtorEditModal: React.FC<DebtorEditModalProps> = ({
  editingId,
  initial,
  onSaved,
  onClose,
}) => {
  const [form, setForm] = useState<DebtorInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editingId && initial) {
      setForm({
        name: initial.name,
        surname: initial.surname,
        email: initial.email || '',
        phone: initial.phone || '',
        data: initial.data || {},
      });
    } else {
      setForm(emptyForm);
    }
    setFormError('');
  }, [editingId, initial]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.surname.trim()) {
      setFormError('Name and surname are required');
      return;
    }
    try {
      setSaving(true);
      setFormError('');
      const saved = editingId
        ? await localDB.updateDebtor(editingId, form)
        : await localDB.insertDebtor(form);
      onSaved(saved);
    } catch (err: any) {
      console.error('Save failed:', err);
      setFormError(err?.message || 'Failed to save debtor');
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
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
            {editingId ? 'Edit Debtor' : 'Add Debtor'}
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
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Surname *</label>
            <input
              style={inputStyle}
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary} disabled={saving}>
            {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Debtor')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebtorEditModal;