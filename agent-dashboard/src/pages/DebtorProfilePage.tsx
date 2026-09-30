import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, ErrorBanner, Spinner } from '@/components/primitives';
import { localDB, Debtor, Debt, Action } from '@/services/local.db';
import DebtorEditModal from '@/components/DebtorEditModal';
import DebtEditModal from '@/components/DebtEditModal';
import ActionEditModal from '@/components/ActionEditModal';
import './DebtorProfilePage.css';

export default function DebtorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [debtsError, setDebtsError] = useState('');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [actions, setActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState('');
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<Action | null>(null);

  const [showEdit, setShowEdit] = useState(false);

  const loadDebtor = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const d = await localDB.getDebtor(id);
      setDebtor(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDebts = async () => {
    if (!id) return;
    try {
      setDebtsLoading(true);
      setDebtsError('');
      const rows = await localDB.getDebts(id);
      setDebts(rows);
    } catch (err) {
      setDebtsError(err instanceof Error ? err.message : String(err));
    } finally {
      setDebtsLoading(false);
    }
  };

  const loadActions = async () => {
    if (!id) return;
    try {
      setActionsLoading(true);
      setActionsError('');
      const rows = await localDB.getActions(id);
      setActions(rows);
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionsLoading(false);
    }
  };

  useEffect(() => {
    loadDebtor();
    loadDebts();
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openAddDebt = () => {
    setEditingDebtId(null);
    setEditingDebt(null);
    setShowDebtForm(true);
  };

  const openEditDebt = (d: Debt) => {
    setEditingDebtId(d.id);
    setEditingDebt(d);
    setShowDebtForm(true);
  };

  const closeDebtForm = () => {
    setShowDebtForm(false);
    setEditingDebtId(null);
    setEditingDebt(null);
  };

  const handleDebtSaved = async () => {
    closeDebtForm();
    await loadDebts();
  };

  const handleDeleteDebt = async (d: Debt) => {
    if (!window.confirm(`Delete this debt of ${d.amount} ${d.currency}?`)) return;
    try {
      await localDB.deleteDebt(d.id);
      await loadDebts();
    } catch (err) {
      setDebtsError(err instanceof Error ? err.message : String(err));
    }
  };

  const openAddAction = () => {
    setEditingActionId(null);
    setEditingAction(null);
    setShowActionForm(true);
  };

  const openEditAction = (a: Action) => {
    setEditingActionId(a.id);
    setEditingAction(a);
    setShowActionForm(true);
  };

  const closeActionForm = () => {
    setShowActionForm(false);
    setEditingActionId(null);
    setEditingAction(null);
  };

  const handleActionSaved = async () => {
    closeActionForm();
    await loadActions();
  };

  const handleDeleteAction = async (a: Action) => {
    if (!window.confirm(`Delete this ${a.type} action?`)) return;
    try {
      await localDB.deleteAction(a.id);
      await loadActions();
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteDebtor = async () => {
    if (!debtor) return;
    const label = `${debtor.name} ${debtor.surname}`.trim();
    if (!window.confirm(`Delete debtor "${label}"? This also deletes their documents.`)) {
      return;
    }
    try {
      await localDB.deleteDebtor(debtor.id);
      navigate('/debtors');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDebtorSaved = (updated: Debtor) => {
    setDebtor(updated);
    setShowEdit(false);
  };

  const debtStatusClass = (status: string): string => {
    if (status === 'PAID') return 'debtor-profile__badge--success';
    if (status === 'OVERDUE') return 'debtor-profile__badge--danger';
    return 'debtor-profile__badge--accent';
  };

  const actionStatusClass = (status: string): string => {
    if (status === 'COMPLETED') return 'debtor-profile__badge--success';
    if (status === 'CANCELLED') return 'debtor-profile__badge--neutral';
    if (status === 'IN_PROGRESS') return 'debtor-profile__badge--info';
    return 'debtor-profile__badge--warning';
  };

  if (loading) {
    return (
      <div className="debtor-profile__state">
        <Spinner size={32} />
        <p className="debtor-profile__state-text">Loading debtor...</p>
      </div>
    );
  }

  if (error || !debtor) {
    return (
      <div className="debtor-profile">
        <button
          type="button"
          className="debtor-profile__back"
          onClick={() => navigate('/debtors')}
        >
          <ArrowLeft size={14} />
          Back to Debtors
        </button>
        <ErrorBanner message={error || 'Debtor not found'} />
      </div>
    );
  }

  return (
    <div className="debtor-profile">
      <div className="debtor-profile__actions-bar">
        <button
          type="button"
          className="debtor-profile__back"
          onClick={() => navigate('/debtors')}
        >
          <ArrowLeft size={14} />
          Back to Debtors
        </button>
        <div className="debtor-profile__actions-bar-right">
          <Button variant="ghost" onClick={() => setShowEdit(true)}>
            <Pencil size={14} />
            Edit
          </Button>
          <Button variant="ghost" onClick={handleDeleteDebtor}>
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>

      <h1 className="debtor-profile__name">
        {debtor.surname}, {debtor.name}
      </h1>
      <p className="debtor-profile__caption">
        Debtor profile, stored locally on your machine
      </p>

      <Card>
        <div className="debtor-profile__grid">
          <div>
            <span className="debtor-profile__label">Name</span>
            <div className="debtor-profile__value">{debtor.name}</div>
          </div>
          <div>
            <span className="debtor-profile__label">Surname</span>
            <div className="debtor-profile__value">{debtor.surname}</div>
          </div>
          <div>
            <span className="debtor-profile__label">Email</span>
            <div className="debtor-profile__value">{debtor.email || '-'}</div>
          </div>
          <div>
            <span className="debtor-profile__label">Phone</span>
            <div className="debtor-profile__value">{debtor.phone || '-'}</div>
          </div>
          <div>
            <span className="debtor-profile__label">Created</span>
            <div className="debtor-profile__value">
              {new Date(debtor.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <span className="debtor-profile__label">Updated</span>
            <div className="debtor-profile__value">
              {new Date(debtor.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="debtor-profile__card-header">
          <h2 className="debtor-profile__card-heading">Debts</h2>
          <Button variant="primary" size="sm" onClick={openAddDebt}>
            + Add Debt
          </Button>
        </div>

        {debtsError && <ErrorBanner message={debtsError} />}

        {debtsLoading ? (
          <p className="debtor-profile__muted">Loading debts...</p>
        ) : debts.length === 0 ? (
          <p className="debtor-profile__muted">No debts recorded yet.</p>
        ) : (
          <ul className="debtor-profile__list">
            {debts.map((d) => (
              <li key={d.id} className="debtor-profile__row">
                <span className="debtor-profile__amount">
                  {d.amount.toLocaleString()} {d.currency}
                </span>
                <span className={`debtor-profile__badge ${debtStatusClass(d.status)}`}>
                  {d.status}
                </span>
                <span className="debtor-profile__row-text">
                  {d.description || '-'}
                  {d.due_date && ` - due ${new Date(d.due_date).toLocaleDateString()}`}
                </span>
                <Button
                  variant="primary"
                  iconOnly
                  onClick={() => openEditDebt(d)}
                  title="Edit debt"
                  aria-label="Edit debt"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="danger"
                  iconOnly
                  onClick={() => handleDeleteDebt(d)}
                  title="Delete debt"
                  aria-label="Delete debt"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="debtor-profile__card-header">
          <h2 className="debtor-profile__card-heading">Actions</h2>
          <Button variant="primary" size="sm" onClick={openAddAction}>
            + Add Action
          </Button>
        </div>

        {actionsError && <ErrorBanner message={actionsError} />}

        {actionsLoading ? (
          <p className="debtor-profile__muted">Loading actions...</p>
        ) : actions.length === 0 ? (
          <p className="debtor-profile__muted">No actions recorded yet.</p>
        ) : (
          <ul className="debtor-profile__list">
            {actions.map((a) => (
              <li key={a.id} className="debtor-profile__row">
                <span
                  className={
                    a.type === 'LEGAL'
                      ? 'debtor-profile__badge debtor-profile__badge--danger'
                      : 'debtor-profile__badge debtor-profile__badge--accent'
                  }
                >
                  {a.type}
                </span>
                <span className={`debtor-profile__badge ${actionStatusClass(a.status)}`}>
                  {a.status}
                </span>
                <span className="debtor-profile__row-text">
                  {a.description || '-'}
                  {a.due_date && ` - due ${new Date(a.due_date).toLocaleDateString()}`}
                  {a.assigned_to && ` - ${a.assigned_to}`}
                </span>
                <Button
                  variant="primary"
                  iconOnly
                  onClick={() => openEditAction(a)}
                  title="Edit action"
                  aria-label="Edit action"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="danger"
                  iconOnly
                  onClick={() => handleDeleteAction(a)}
                  title="Delete action"
                  aria-label="Delete action"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showEdit && (
        <DebtorEditModal
          editingId={debtor.id}
          initial={debtor}
          onSaved={handleDebtorSaved}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showDebtForm && id && (
        <DebtEditModal
          debtorId={id}
          editingId={editingDebtId}
          initial={editingDebt}
          onSaved={handleDebtSaved}
          onClose={closeDebtForm}
        />
      )}

      {showActionForm && id && (
        <ActionEditModal
          debtorId={id}
          editingId={editingActionId}
          initial={editingAction}
          onSaved={handleActionSaved}
          onClose={closeActionForm}
        />
      )}
    </div>
  );
}