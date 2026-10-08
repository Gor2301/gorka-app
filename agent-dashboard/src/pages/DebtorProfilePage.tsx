import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Pencil, Trash2, FileText, Upload } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Select,
  Spinner,
} from '@/components/primitives';
import {
  localDB,
  Debtor,
  Debt,
  Action,
  Communication,
  Document,
  DebtorRelation,
} from '@/services/local.db';
import DebtorEditModal from '@/components/DebtorEditModal';
import DebtEditModal from '@/components/DebtEditModal';
import ActionEditModal from '@/components/ActionEditModal';
import CommunicationEditModal from '@/components/CommunicationEditModal';
import RelationEditModal, { RelationRole } from '@/components/RelationEditModal';
import CommunicationCard from '@/components/CommunicationCard';
import './DebtorProfilePage.css';

const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'profile_photo',    label: 'Profile Photo' },
  { value: 'id_card',          label: 'ID Card' },
  { value: 'passport',         label: 'Passport' },
  { value: 'driver_license',   label: "Driver's License" },
  { value: 'contract',         label: 'Contract' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'income_proof',     label: 'Income Proof' },
  { value: 'collateral_photo', label: 'Collateral Photo' },
  { value: 'other',            label: 'Other' },
];

export default function DebtorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Back target resolution order:
  //   1. From a Relations card: return to that debtor's profile.
  //   2. From ActionsPage (or any caller passing fromPath):
  //      return to that path.
  //   3. Otherwise: return to the debtors list.
  const backState =
    (location.state as
      | {
          fromDebtorId?: string;
          fromDebtorLabel?: string;
          fromPath?: string;
          fromLabel?: string;
        }
      | null) ?? null;

  let backLabel = 'Back to Debtors';
  let backTarget = '/debtors';

  if (backState?.fromDebtorId) {
    backLabel = backState.fromDebtorLabel
      ? `Back to ${backState.fromDebtorLabel}`
      : 'Back to Debtors';
    backTarget = `/debtors/${backState.fromDebtorId}`;
  } else if (backState?.fromPath) {
    backLabel = backState.fromLabel
      ? `Back to ${backState.fromLabel}`
      : 'Back to Debtors';
    backTarget = backState.fromPath;
  }

  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [debtsError, setDebtsError] = useState('');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [relations, setRelations] = useState<DebtorRelation[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [relationsError, setRelationsError] = useState('');
  const [relatedRoles, setRelatedRoles] = useState<string[]>([]);
  const [relationModalRole, setRelationModalRole] = useState<RelationRole | null>(null);
  const [collateralMap, setCollateralMap] = useState<
    Record<string, { type?: string; description?: string }>
  >({});

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(true);
  const [communicationsError, setCommunicationsError] = useState('');
  const [showCommunicationForm, setShowCommunicationForm] = useState(false);

  const [actions, setActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState('');
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<Action | null>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploading, setUploading] = useState(false);

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

  const loadPhoto = async (debtorId: string) => {
    try {
      const data = await localDB.readDebtorPhoto(debtorId);
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
      if (data) {
        const blob = new Blob(
          [new Uint8Array(data.bytes)],
          { type: data.mime },
        );
        const url = URL.createObjectURL(blob);
        photoUrlRef.current = url;
        setPhotoUrl(url);
      } else {
        setPhotoUrl(null);
      }
    } catch {
      setPhotoUrl(null);
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

  const loadRelations = async () => {
    if (!id) return;
    try {
      setRelationsLoading(true);
      setRelationsError('');
      const rows = await localDB.getDebtorRelations(id);
      setRelations(rows);

      // Fetch collateral for PLEDGER relations. The relation row
      // does not carry the related person's data JSON, so one
      // get_debtor per PLEDGER is needed. Acceptable N+1 for MVP.
      const pledges = rows.filter((r) => r.relation_type === 'PLEDGER');
      if (pledges.length > 0) {
        const map: Record<string, { type?: string; description?: string }> = {};
        await Promise.all(
          pledges.map(async (r) => {
            try {
              const d = await localDB.getDebtor(r.related_debtor_id);
              const c = d.data && typeof d.data === 'object' ? d.data.collateral : null;
              if (c && typeof c === 'object') {
                map[r.related_debtor_id] = {
                  type: typeof c.type === 'string' ? c.type : undefined,
                  description:
                    typeof c.description === 'string'
                      ? c.description
                      : undefined,
                };
              }
            } catch {
              // Collateral fetch failure is not fatal. Row shows without it.
            }
          }),
        );
        setCollateralMap(map);
      } else {
        setCollateralMap({});
      }
    } catch (err) {
      setRelationsError(err instanceof Error ? err.message : String(err));
    } finally {
      setRelationsLoading(false);
    }
  };

  const loadRelatedRoles = async () => {
    if (!id) return;
    try {
      const rows = await localDB.getRelatedDebtorRoles();
      setRelatedRoles(
        rows.filter((r) => r.debtor_id === id).map((r) => r.relation_type),
      );
    } catch {
      setRelatedRoles([]);
    }
  };

  const loadCommunications = async () => {
    if (!id) return;
    try {
      setCommunicationsLoading(true);
      setCommunicationsError('');
      const rows = await localDB.getCommunications(id);
      setCommunications(rows);
    } catch (err) {
      setCommunicationsError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommunicationsLoading(false);
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

  const loadDocuments = async () => {
    if (!id) return;
    try {
      setDocumentsLoading(true);
      setDocumentsError('');
      const rows = await localDB.getDocuments(id, 'debtor');
      setDocuments(rows);
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : String(err));
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    loadDebtor();
    if (id) loadPhoto(id);
    loadDebts();
    loadRelations();
    loadRelatedRoles();
    loadCommunications();
    loadActions();
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
    };
  }, []);

  const handleChangePhoto = async () => {
    if (!debtor) return;
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
        },
      ],
    });
    if (!selected || typeof selected !== 'string') return;
    try {
      await localDB.setDebtorPhoto(debtor.id, selected);
      await loadPhoto(debtor.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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

  const openAddRelation = (role: RelationRole) => setRelationModalRole(role);
  const closeRelationForm = () => setRelationModalRole(null);

  const handleRelationSaved = async () => {
    closeRelationForm();
    await loadRelations();
  };

  const handleDeleteRelation = async (r: DebtorRelation) => {
    const label = `${r.related_name} ${r.related_surname}`.trim();
    if (!window.confirm(`Remove relation with "${label}"?`)) return;
    try {
      await localDB.deleteDebtorRelation(r.id);
      await loadRelations();
    } catch (err) {
      setRelationsError(err instanceof Error ? err.message : String(err));
    }
  };

  const openRelationProfile = (r: DebtorRelation) => {
    const label = debtor ? `${debtor.surname}, ${debtor.name}` : undefined;
    navigate(`/debtors/${r.related_debtor_id}`, {
      state: { fromDebtorId: id, fromDebtorLabel: label },
    });
  };

  const openCommunicationForm = () => setShowCommunicationForm(true);
  const closeCommunicationForm = () => setShowCommunicationForm(false);

  const handleCommunicationSaved = async () => {
    closeCommunicationForm();
    await loadCommunications();
  };

  const handleDeleteCommunication = async (c: Communication) => {
    if (!window.confirm(`Delete this ${c.type} communication?`)) return;
    try {
      await localDB.deleteCommunication(c.id);
      await loadCommunications();
    } catch (err) {
      setCommunicationsError(err instanceof Error ? err.message : String(err));
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

  const handleUploadDocument = async (file: File) => {
    if (!id) return;
    try {
      setUploading(true);
      setDocumentsError('');
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      await localDB.uploadDocument({
        entity_id: id,
        entity_type: 'debtor',
        file_name: file.name,
        file_content: bytes,
        file_type: file.type || 'application/octet-stream',
        category: uploadCategory,
        is_primary: false,
      });
      await loadDocuments();
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!window.confirm(`Delete document "${doc.file_name}"?`)) return;
    try {
      await localDB.deleteDocument(doc.id);
      await loadDocuments();
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : String(err));
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

  const relationBadgeClass = (relationType: string): string => {
    if (relationType === 'PLEDGER') return 'debtor-profile__badge--info';
    return 'debtor-profile__badge--accent';
  };

  const formatBytes = (n: number): string => {
    if (!n) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const isRelated = relatedRoles.length > 0;

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
          onClick={() => navigate(backTarget)}
        >
          <ArrowLeft size={14} />
          {backLabel}
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
          onClick={() => navigate(backTarget)}
        >
          <ArrowLeft size={14} />
          {backLabel}
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
        <div className="debtor-profile__header">
          <div className="debtor-profile__photo-block">
            {photoUrl ? (
              <img
                className="debtor-profile__photo"
                src={photoUrl}
                alt="Debtor profile"
              />
            ) : (
              <div className="debtor-profile__photo">
                <Avatar
                  name={`${debtor.name} ${debtor.surname}`}
                  size={96}
                />
              </div>
            )}
            <button
              type="button"
              className="debtor-profile__photo-change"
              onClick={handleChangePhoto}
            >
              Change photo
            </button>
          </div>

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
        </div>
      </Card>

         {!isRelated && (
        <Card>
          <CommunicationCard
            debtorId={debtor.id}
            debtorName={`${debtor.name} ${debtor.surname}`.trim()}
            onSent={handleCommunicationSaved}
          />
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
      )}

      <Card>
        <div className="debtor-profile__card-header">
          <h2 className="debtor-profile__card-heading">
            {relations.length > 0
              ? `Relations (${relations.length})`
              : 'Relations'}
          </h2>
          {!isRelated && (
            <div className="debtor-profile__card-header-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openAddRelation('GUARANTOR')}
              >
                + Add Guarantor
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openAddRelation('PLEDGER')}
              >
                + Add Pledger
              </Button>
            </div>
          )}
        </div>

        {relationsError && <ErrorBanner message={relationsError} />}

        {relationsLoading ? (
          <p className="debtor-profile__muted">Loading relations...</p>
        ) : relations.length === 0 ? (
          <p className="debtor-profile__muted">No relations recorded yet.</p>
        ) : (
          <ul className="debtor-profile__list">
            {relations.map((r) => {
              const collateral = collateralMap[r.related_debtor_id];
              const collateralText =
                collateral && (collateral.type || collateral.description)
                  ? `Collateral: ${[collateral.type, collateral.description]
                      .filter(Boolean)
                      .join(' - ')}`
                  : null;
              return (
                <li key={r.id} className="debtor-profile__row">
                  <span className={`debtor-profile__badge ${relationBadgeClass(r.relation_type)}`}>
                    {r.relation_type}
                  </span>
                  <button
                    type="button"
                    className="debtor-profile__relation-link"
                    onClick={() => openRelationProfile(r)}
                  >
                    {r.related_surname}, {r.related_name}
                  </button>
                  <span className="debtor-profile__row-text">
                    {collateralText || '-'}
                  </span>
                  <Button
                    variant="danger"
                    iconOnly
                    onClick={() => handleDeleteRelation(r)}
                    title="Delete relation"
                    aria-label="Delete relation"
                  >
                    <Trash2 size={14} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="debtor-profile__card-header">
          <h2 className="debtor-profile__card-heading">Communications</h2>
          <Button variant="primary" size="sm" onClick={openCommunicationForm}>
            + Log Communication
          </Button>
        </div>

        {communicationsError && <ErrorBanner message={communicationsError} />}

        {communicationsLoading ? (
          <p className="debtor-profile__muted">Loading communications...</p>
        ) : communications.length === 0 ? (
          <p className="debtor-profile__muted">No communications logged yet.</p>
        ) : (
          <ul className="debtor-profile__list">
            {communications.map((c) => (
              <li key={c.id} className="debtor-profile__row">
                <span className="debtor-profile__badge debtor-profile__badge--accent">
                  {c.type}
                </span>
                <span
                  className={
                    c.direction === 'INBOUND'
                      ? 'debtor-profile__badge debtor-profile__badge--info'
                      : 'debtor-profile__badge debtor-profile__badge--warning'
                  }
                >
                  {c.direction}
                </span>
                <span className="debtor-profile__row-text">
                  {c.content || '-'}
                  {c.duration != null && ` - ${c.duration}s`}
                </span>
                <span className="debtor-profile__timestamp">
                  {new Date(c.created_at).toLocaleString()}
                </span>
                <Button
                  variant="danger"
                  iconOnly
                  onClick={() => handleDeleteCommunication(c)}
                  title="Delete communication"
                  aria-label="Delete communication"
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

      <Card>
        <div className="debtor-profile__card-header">
          <h2 className="debtor-profile__card-heading">Documents</h2>
        </div>

        {documentsError && <ErrorBanner message={documentsError} />}

        {documentsLoading ? (
          <p className="debtor-profile__muted">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="debtor-profile__muted">No documents yet.</p>
        ) : (
          <ul className="debtor-profile__list">
            {documents.map((doc) => (
              <li key={doc.id} className="debtor-profile__row">
                <FileText size={14} className="debtor-profile__doc-icon" />
                <span className="debtor-profile__row-text">{doc.file_name}</span>
                <span className="debtor-profile__doc-meta">
                  {doc.category} - {formatBytes(doc.file_size)}
                </span>
                <Button
                  variant="danger"
                  iconOnly
                  onClick={() => handleDeleteDocument(doc)}
                  title="Delete document"
                  aria-label="Delete document"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="debtor-profile__upload-row">
          <Select
            className="debtor-profile__upload-category"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>

          <label className="debtor-profile__upload-label">
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Choose file'}
            <input
              type="file"
              className="debtor-profile__upload-input"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadDocument(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
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

      {relationModalRole && id && (
        <RelationEditModal
          debtorId={id}
          role={relationModalRole}
          onSaved={handleRelationSaved}
          onClose={closeRelationForm}
        />
      )}

      {showCommunicationForm && id && (
        <CommunicationEditModal
          debtorId={id}
          onSaved={handleCommunicationSaved}
          onClose={closeCommunicationForm}
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