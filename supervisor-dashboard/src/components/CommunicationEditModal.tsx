import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { localDB, Communication, CommunicationInput } from '../services/local.db';

export interface CommunicationEditModalProps {
  /** The debtor this communication belongs to. */
  debtorId: string;
  /** Existing communication values when editing. Ignored in create mode. */
  initial?: Communication | null;
  /** Called after a successful save. */
  onSaved: (comm: Communication) => void;
  /** Called when the user closes the modal without saving. */
  onClose: () => void;
}

const emptyForm = {
  type: 'CALL',
  direction: 'OUTBOUND',
  content: '',
  duration: '',
};

const TYPE_OPTIONS = ['CALL', 'EMAIL', 'SMS', 'NOTE'] as const;
const DIRECTION_OPTIONS = ['INBOUND', 'OUTBOUND'] as const;

const CommunicationEditModal: React.FC<CommunicationEditModalProps> = ({
  debtorId,
  initial,
  onSaved,
  onClose,
}) => {
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        type: initial.type || 'CALL',
        direction: initial.direction || 'OUTBOUND',
        content: initial.content || '',
        duration: initial.duration != null ? String(initial.duration) : '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setFormError('');
  }, [initial]);

  const handleSave = async () => {
    let durationNum: number | null = null;
    if (form.type === 'CALL' && form.duration.trim() !== '') {
      const parsed = parseInt(form.duration, 10);
      if (isNaN(parsed) || parsed < 0) {
        setFormError('Duration must be a non-negative whole number');
        return;
      }
      durationNum = parsed;
    }
    try {
      setSaving(true);
      setFormError('');
      const payload: CommunicationInput = {
        debtor_id: debtorId,
        type: form.type,
        direction: form.direction,
        content: form.content || null,
        duration: durationNum,
      };
      const saved = await localDB.insertCommunication(payload);
      onSaved(saved);
    } catch (err: any) {
      console.error('Save communication failed:', err);
      setFormError(err?.message || 'Failed to save communication');
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
            Log Communication
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
              <label style={labelStyle}>Direction</label>
              <select
                style={inputStyle}
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
              >
                {DIRECTION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Content</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>

          {form.type === 'CALL' && (
            <div>
              <label style={labelStyle}>Duration (seconds, optional)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="1"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary} disabled={saving}>
            {saving ? 'Saving...' : 'Log Communication'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunicationEditModal;