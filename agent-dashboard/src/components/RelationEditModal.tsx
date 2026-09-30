import { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Label,
  ErrorBanner,
  Spinner,
} from './primitives';
import { localDB, Debtor } from '@/services/local.db';
import './RelationEditModal.css';

export type RelationRole = 'GUARANTOR' | 'PLEDGER';

export interface RelationEditModalProps {
  /** The primary debtor to which the relation is attached. */
  debtorId: string;
  /** The role for the new relation. Determines the title and
      whether the collateral fields are shown. */
  role: RelationRole;
  /** Called after a successful save. */
  onSaved: () => void;
  /** Called when the user closes the modal without saving. */
  onClose: () => void;
}

type Mode = 'create' | 'link';

export default function RelationEditModal({
  debtorId,
  role,
  onSaved,
  onClose,
}: RelationEditModalProps) {
  const [mode, setMode] = useState<Mode>('create');

  // Create mode fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Collateral fields (PLEDGER only)
  const [collateralType, setCollateralType] = useState('');
  const [collateralDescription, setCollateralDescription] = useState('');

  // Link mode fields
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Debtor[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isPledger = role === 'PLEDGER';
  const title = role === 'GUARANTOR' ? 'Add Guarantor' : 'Add Pledger';

  const buildCollateralData = (): Record<string, unknown> | null => {
    if (!isPledger) return null;
    if (!collateralType.trim() && !collateralDescription.trim()) return null;
    return {
      type: collateralType.trim(),
      description: collateralDescription.trim(),
    };
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      setFormError('');
      const rows = await localDB.searchDebtors(q);
      setSearchResults(rows.filter((d) => d.id !== debtorId));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const pickDebtor = (d: Debtor) => {
    setSelectedDebtor(d);
    setSearchResults([]);
    setSearchQuery(`${d.surname}, ${d.name}`);

    const existing =
      d.data && typeof d.data === 'object'
        ? (d.data.collateral as { type?: string; description?: string } | undefined)
        : undefined;

    if (isPledger && existing) {
      setCollateralType(existing.type ?? '');
      setCollateralDescription(existing.description ?? '');
    }
  };

  const handleSave = async () => {
    if (mode === 'create') {
      if (!name.trim() || !surname.trim()) {
        setFormError('Name and surname are required');
        return;
      }
    } else {
      if (!selectedDebtor) {
        setFormError('Select a debtor to link');
        return;
      }
      if (selectedDebtor.id === debtorId) {
        setFormError('Cannot create a relation to the same debtor');
        return;
      }
    }

    try {
      setSaving(true);
      setFormError('');

      let relatedId: string;

      if (mode === 'create') {
        const collateral = buildCollateralData();
        const data: Record<string, unknown> = {};
        if (collateral) data.collateral = collateral;

        const created = await localDB.insertDebtor({
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          data,
        });
        relatedId = created.id;
      } else {
        const debtor = selectedDebtor!;
        relatedId = debtor.id;

        const collateral = buildCollateralData();
        if (collateral) {
          const baseData =
            debtor.data && typeof debtor.data === 'object'
              ? { ...debtor.data }
              : {};
          baseData.collateral = collateral;
          await localDB.updateDebtor(debtor.id, {
            name: debtor.name,
            surname: debtor.surname,
            email: debtor.email,
            phone: debtor.phone,
            data: baseData,
          });
        }
      }

      await localDB.insertDebtorRelation({
        debtor_id: debtorId,
        related_debtor_id: relatedId,
        relation_type: role,
      });

      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={title}
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {mode === 'create' ? `Create ${role === 'GUARANTOR' ? 'Guarantor' : 'Pledger'}` : 'Link Person'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="relation-edit-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}

      <div className="relation-edit-modal__mode">
        <label className="relation-edit-modal__mode-option">
          <input
            type="radio"
            name="relation-mode"
            checked={mode === 'create'}
            onChange={() => setMode('create')}
          />
          <span>Create new person</span>
        </label>
        <label className="relation-edit-modal__mode-option">
          <input
            type="radio"
            name="relation-mode"
            checked={mode === 'link'}
            onChange={() => setMode('link')}
          />
          <span>Link existing debtor</span>
        </label>
      </div>

      <div className="relation-edit-modal__fields">
        {mode === 'create' ? (
          <>
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Surname *</Label>
              <Input
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="relation-edit-modal__link">
            <div>
              <Label>Search debtor</Label>
              <Input
                placeholder="Name, surname, email, phone..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            {searching && (
              <div className="relation-edit-modal__searching">
                <Spinner size={20} />
              </div>
            )}
            {searchResults.length > 0 && (
              <ul className="relation-edit-modal__results">
                {searchResults.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="relation-edit-modal__result"
                      onClick={() => pickDebtor(d)}
                    >
                      <span className="relation-edit-modal__result-name">
                        {d.surname}, {d.name}
                      </span>
                      {d.email && (
                        <span className="relation-edit-modal__result-meta">
                          {d.email}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedDebtor && (
              <p className="relation-edit-modal__picked">
                Selected: <strong>{selectedDebtor.surname}, {selectedDebtor.name}</strong>
              </p>
            )}
          </div>
        )}

        {isPledger && (
          <>
            <div>
              <Label>Collateral type</Label>
              <Input
                placeholder="Car, house, jewelry..."
                value={collateralType}
                onChange={(e) => setCollateralType(e.target.value)}
              />
            </div>
            <div>
              <Label>Collateral description</Label>
              <Input
                value={collateralDescription}
                onChange={(e) =>
                  setCollateralDescription(e.target.value)
                }
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}