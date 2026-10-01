// ActionsPage - cross-debtor actions browser.
//
// Read-only. No add, no edit, no delete. Per the D.6 scope
// decision (Q4): those live on the debtor profile. This page
// answers "what should I do next" and navigates to a debtor
// when one is clicked.
//
// Status filter chips are client-side. No server round-trip.
// No Type filter, no text search in D.6.2. Both are natural
// follow-ups, recorded as deferred in the extraction log.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { ErrorBanner, Spinner } from '@/components/primitives';
import { localDB, ActionWithDebtor } from '@/services/local.db';
import './ActionsPage.css';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export default function ActionsPage() {
  const navigate = useNavigate();

  const [actions, setActions] = useState<ActionWithDebtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const loadActions = async () => {
    try {
      setLoading(true);
      setError('');
      const rows = await localDB.getAllActions();
      setActions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDebtor = (a: ActionWithDebtor) => {
    navigate(`/debtors/${a.debtor_id}`, {
      state: { fromPath: '/actions', fromLabel: 'Actions' },
    });
  };

  const typeBadgeClass = (type: string): string => {
    if (type === 'LEGAL') return 'actions-page__badge--danger';
    return 'actions-page__badge--accent';
  };

  const statusBadgeClass = (status: string): string => {
    if (status === 'COMPLETED') return 'actions-page__badge--success';
    if (status === 'CANCELLED') return 'actions-page__badge--neutral';
    if (status === 'IN_PROGRESS') return 'actions-page__badge--info';
    return 'actions-page__badge--warning';
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const truncate = (text: string | null): string => {
    if (!text) return '-';
    if (text.length <= 60) return text;
    return text.slice(0, 60) + '...';
  };

  const visible =
    filter === 'ALL'
      ? actions
      : actions.filter((a) => a.status === filter);

  return (
    <div className="actions-page">
      <div className="actions-page__header">
        <p className="actions-page__subtitle">
          Actions across all debtors, stored locally on your machine
        </p>
      </div>

      <div className="actions-page__filters">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={
              filter === f.value
                ? 'actions-page__chip actions-page__chip--active'
                : 'actions-page__chip'
            }
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="actions-page__error">
          <ErrorBanner message={error} />
          <button
            type="button"
            className="actions-page__retry"
            onClick={loadActions}
          >
            Retry
          </button>
        </div>
      )}

      <div className="actions-page__container">
        {loading ? (
          <div className="actions-page__state">
            <Spinner size={32} />
            <p className="actions-page__state-text">Loading actions...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="actions-page__state">
            <ClipboardList size={40} className="actions-page__empty-icon" />
            <p className="actions-page__empty-text">
              No actions recorded yet.
            </p>
          </div>
        ) : (
          <table className="actions-page__table">
            <thead>
              <tr>
                <th>Debtor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id}>
                  <td>
                    <button
                      type="button"
                      className="actions-page__name-link"
                      onClick={() => openDebtor(a)}
                    >
                      {a.debtor_surname}, {a.debtor_name}
                    </button>
                  </td>
                  <td>
                    <span
                      className={`actions-page__badge ${typeBadgeClass(a.type)}`}
                    >
                      {a.type}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`actions-page__badge ${statusBadgeClass(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="actions-page__cell--muted">
                    {a.assigned_to || '-'}
                  </td>
                  <td className="actions-page__cell--muted">
                    {formatDate(a.due_date)}
                  </td>
                  <td className="actions-page__cell--muted">
                    {truncate(a.description)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}