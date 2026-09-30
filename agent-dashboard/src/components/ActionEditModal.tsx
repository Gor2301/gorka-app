import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Label,
  Select,
  Textarea,
  ErrorBanner,
} from './primitives';
import { localDB, Action, ActionInput } from '@/services/local.db';
import './ActionEditModal.css';

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

export default function ActionEditModal({
  debtorId,
  editingId,
  initial,
  onSaved,
  onClose,
}: ActionEditModalProps) {
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editingId ? 'Edit Action' : 'Add Action'}
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editingId ? 'Save Changes' : 'Create Action'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="action-edit-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}
      <div className="action-edit-modal__fields">
        <div className="action-edit-modal__row">
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
        </div>

        <div className="action-edit-modal__row">
          <div>
            <Label>Assigned To</Label>
            <Input
              value={form.assigned_to}
              onChange={(e) =>
                setForm({ ...form, assigned_to: e.target.value })
              }
              placeholder="Leave empty for now"
            />
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
          <Textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>
      </div>
    </Modal>
  );
}