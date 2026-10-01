import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, ErrorBanner, Input, Spinner } from '@/components/primitives';
import {
  localDB,
  Debtor,
  DebtorDebtTotal,
} from '@/services/local.db';
import DebtorEditModal from '@/components/DebtorEditModal';
import './DebtorsPage.css';

export default function DebtorsPage() {
  const navigate = useNavigate();

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [roleMap, setRoleMap] = useState<Record<string, string[]>>({});
  const [debtMap, setDebtMap] = useState<Record<string, DebtorDebtTotal[]>>({});
  const [allTotals, setAllTotals] = useState<DebtorDebtTotal[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);

  const loadDebtors = async () => {
    try {
      setLoading(true);
      setError('');
      const rows = await localDB.getPrimaryDebtors();
      setDebtors(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRolesAndTotals = async () => {
    const [roles, totals] = await Promise.all([
      localDB.getPrimaryDebtorRelations(),
      localDB.getDebtorDebtTotals(),
    ]);

    const rmap: Record<string, string[]> = {};
    for (const r of roles) {
      if (!rmap[r.debtor_id]) rmap[r.debtor_id] = [];
      rmap[r.debtor_id].push(r.relation_type);
    }

    const dmap: Record<string, DebtorDebtTotal[]> = {};
    for (const t of totals) {
      if (!dmap[t.debtor_id]) dmap[t.debtor_id] = [];
      dmap[t.debtor_id].push(t);
    }

    setRoleMap(rmap);
    setDebtMap(dmap);
    setAllTotals(totals);
  };

  useEffect(() => {
    (async () => {
      try {
        await localDB.cleanupOrphanedRelatedDebtors();
      } catch {
        // Cleanup failure is not fatal to the list.
      }
      await loadDebtors();
      try {
        await loadRolesAndTotals();
      } catch {
        // Roles/totals failure is not fatal to the list.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const rows = await localDB.searchPrimaryDebtors(q);
      setDebtors(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await handleSearch(query);
    try {
      await loadRolesAndTotals();
    } catch {
      // Non-fatal.
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
    await refresh();
  };

  const handleDelete = async (d: Debtor) => {
    const label = `${d.name} ${d.surname}`.trim();
    if (!window.confirm(`Delete debtor "${label}"? This also deletes their documents.`)) {
      return;
    }
    try {
      await localDB.deleteDebtor(d.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openDetail = (d: Debtor) => {
    navigate(`/debtors/${d.id}`);
  };

  // Whole-org totals by currency. Not affected by the search filter.
  const orgTotals = (() => {
    const byCurrency: Record<string, number> = {};
    for (const t of allTotals) {
      byCurrency[t.currency] = (byCurrency[t.currency] ?? 0) + t.total_amount;
    }
    return Object.entries(byCurrency)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => ({ currency, amount }));
  })();

  const roleBadgeClass = (relationType: string): string => {
    if (relationType === 'PLEDGER') return 'debtors-page__role-badge--pledger';
    return 'debtors-page__role-badge--guarantor';
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
                <th className="debtors-page__cell--right">Debt</th>
                <th>Currency</th>
                <th>Role</th>
                <th className="debtors-page__cell--right">Actions</th>
              </tr>
              <tr className="debtors-page__total-row">
                <td>
                  <span className="debtors-page__total-label">TOTAL</span>
                </td>
                <td></td>
                <td></td>
                <td className="debtors-page__cell--right">
                  {orgTotals.length === 0
                    ? '-'
                    : orgTotals.map((t) => (
                        <div key={t.currency}>
                          {t.amount.toLocaleString()}
                        </div>
                      ))}
                </td>
                <td>
                  {orgTotals.map((t) => (
                    <div key={t.currency}>{t.currency}</div>
                  ))}
                </td>
                <td></td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => {
                const totals = [...(debtMap[d.id] ?? [])].sort((a, b) =>
                  a.currency.localeCompare(b.currency),
                );
                const roles = roleMap[d.id] ?? [];

                return (
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
                      {totals.length === 0 ? (
                        '0'
                      ) : (
                        totals.map((t) => (
                          <div key={t.currency}>
                            {t.total_amount.toLocaleString()}
                          </div>
                        ))
                      )}
                    </td>
                    <td>
                      {totals.map((t) => (
                        <div key={t.currency}>{t.currency}</div>
                      ))}
                    </td>
                    <td>
                      {roles.length > 0 && (
                        <div className="debtors-page__role-badges">
                          {roles.map((r, i) => (
                            <span
                              key={`${r}-${i}`}
                              className={`debtors-page__role-badge ${roleBadgeClass(r)}`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
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
                );
              })}
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