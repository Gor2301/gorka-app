import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, ErrorBanner, Input, Spinner } from '@/components/primitives';
import { localDB, Debtor } from '@/services/local.db';
import DebtorEditModal from '@/components/DebtorEditModal';
import './DebtorsPage.css';

export default function DebtorsPage() {
  const navigate = useNavigate();

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);

  const loadDebtors = async () => {
    try {
      setLoading(true);
      setError('');
      const rows = await localDB.getDebtors();
      setDebtors(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebtors();
  }, []);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      await loadDebtors();
      return;
    }
    try {
      setLoading(true);
      setError('');
      const rows = await localDB.searchDebtors(q);
      setDebtors(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setEditingDebtor(null);
    setShowForm(true);
  };

  const openEdit = (d: Debtor) => {
    setEditingId(d.id);
    setEditingDebtor(d);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingDebtor(null);
  };

  const handleSaved = async () => {
    closeForm();
    await handleSearch(query);
  };

  const handleDelete = async (d: Debtor) => {
    const label = `${d.name} ${d.surname}`.trim();
    if (!window.confirm(`Delete debtor "${label}"? This also deletes their documents.`)) {
      return;
    }
    try {
      await localDB.deleteDebtor(d.id);
      await handleSearch(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openDetail = (d: Debtor) => {
    navigate(`/debtors/${d.id}`);
  };

  return (
    <div className="debtors-page">
      <div className="debtors-page__header">
        <p className="debtors-page__subtitle">
          Debtor records stored locally on your machine
        </p>
        <Button variant="primary" onClick={openAdd}>
          <Plus size={16} />
          Add Debtor
        </Button>
      </div>

      <div className="debtors-page__search">
        <Search size={16} className="debtors-page__search-icon" />
        <Input
          type="text"
          placeholder="Search by name, surname, email, phone..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="debtors-page__error">
          <ErrorBanner message={error} />
          <button
            type="button"
            className="debtors-page__retry"
            onClick={loadDebtors}
          >
            Retry
          </button>
        </div>
      )}

      <div className="debtors-page__container">
        {loading ? (
          <div className="debtors-page__state">
            <Spinner size={32} />
            <p className="debtors-page__state-text">Loading debtors...</p>
          </div>
        ) : debtors.length === 0 ? (
          <div className="debtors-page__state">
            <Users size={40} className="debtors-page__empty-icon" />
            <p className="debtors-page__empty-title">
              {query ? 'No matching debtors' : 'No debtors yet'}
            </p>
            <p className="debtors-page__empty-text">
              {query
                ? 'Try a different search term.'
                : 'Click "Add Debtor" to create your first record.'}
            </p>
          </div>
        ) : (
          <table className="debtors-page__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="debtors-page__cell--right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button
                      type="button"
                      className="debtors-page__name-link"
                      onClick={() => openDetail(d)}
                    >
                      {d.surname}, {d.name}
                    </button>
                  </td>
                  <td className="debtors-page__cell--muted">
                    {d.email || '-'}
                  </td>
                  <td className="debtors-page__cell--muted">
                    {d.phone || '-'}
                  </td>
                  <td className="debtors-page__cell--right">
                    <Button
                      variant="primary"
                      iconOnly
                      onClick={() => openEdit(d)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="danger"
                      iconOnly
                      onClick={() => handleDelete(d)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <DebtorEditModal
          editingId={editingId}
          initial={editingDebtor}
          onSaved={handleSaved}
          onClose={closeForm}
        />
      )}
    </div>
  );
}