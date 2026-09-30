import { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Label,
  Select,
  Textarea,
  ErrorBanner,
} from './primitives';
import { localDB, Communication, CommunicationInput } from '@/services/local.db';
import './CommunicationEditModal.css';

export interface CommunicationEditModalProps {
  /** The debtor this communication belongs to. */
  debtorId: string;
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

export default function CommunicationEditModal({
  debtorId,
  onSaved,
  onClose,
}: CommunicationEditModalProps) {
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to save communication');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Log Communication"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Log Communication
          </Button>
        </>
      }
    >
      {formError && (
        <div className="communication-edit-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}
      <div className="communication-edit-modal__fields">
        <div className="communication-edit-modal__row">
          <div>
            <Label>Type</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select
              value={form.direction}
              onChange={(e) =>
                setForm({ ...form, direction: e.target.value })
              }
            >
              {DIRECTION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Content</Label>
          <Textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </div>

        {form.type === 'CALL' && (
          <div>
            <Label>Duration (seconds, optional)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: e.target.value })
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}