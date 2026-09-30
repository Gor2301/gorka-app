import { useState, useEffect } from 'react';
import { Modal, Button, Input, Label, ErrorBanner } from './primitives';
import { localDB, Debtor, DebtorInput } from '@/services/local.db';
import './DebtorEditModal.css';

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

const emptyForm: DebtorInput = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  data: {},
};

export default function DebtorEditModal({
  editingId,
  initial,
  onSaved,
  onClose,
}: DebtorEditModalProps) {
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      setFormError(message || 'Failed to save debtor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editingId ? 'Edit Debtor' : 'Add Debtor'}
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editingId ? 'Save Changes' : 'Create Debtor'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="debtor-edit-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}
      <div className="debtor-edit-modal__fields">
        <div>
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Surname *</Label>
          <Input
            value={form.surname}
            onChange={(e) => setForm({ ...form, surname: e.target.value })}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={form.phone || ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}