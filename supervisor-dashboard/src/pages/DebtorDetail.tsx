import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Upload, FileText, AlertCircle } from 'lucide-react';
import { localDB, Debtor, Document, Debt, Communication, Action } from '../services/local.db';
import DebtorEditModal from '../components/DebtorEditModal';
import DebtEditModal from '../components/DebtEditModal';
import CommunicationEditModal from '../components/CommunicationEditModal';
import ActionEditModal from '../components/ActionEditModal';

// Document categories, matching the Rust DocumentCategory enum.
// Extend here if Rust gains new variants.
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

const DebtorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploading, setUploading] = useState(false);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsError, setDebtsError] = useState('');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [communicationsError, setCommunicationsError] = useState('');
  const [showCommunicationForm, setShowCommunicationForm] = useState(false);

  const [actions, setActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
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
    } catch (err: any) {
      console.error('Load debtor failed:', err);
      setError(err?.message || 'Failed to load debtor');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!id) return;
    try {
      setDocumentsLoading(true);
      setDocumentsError('');
      const docs = await localDB.getDocuments(id, 'debtor');
      setDocuments(docs);
    } catch (err: any) {
      console.error('Load documents failed:', err);
      setDocumentsError(err?.message || 'Failed to load documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadDebts = async () => {
    if (!id) return;
    try {
      setDebtsLoading(true);
      setDebtsError('');
      const rows = await localDB.getDebts(id);
      setDebts(rows);
    } catch (err: any) {
      console.error('Load debts failed:', err);
      setDebtsError(err?.message || 'Failed to load debts');
    } finally {
      setDebtsLoading(false);
    }
  };

  const loadCommunications = async () => {
    if (!id) return;
    try {
      setCommunicationsLoading(true);
      setCommunicationsError('');
      const rows = await localDB.getCommunications(id);
      setCommunications(rows);
    } catch (err: any) {
      console.error('Load communications failed:', err);
      setCommunicationsError(err?.message || 'Failed to load communications');
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
    } catch (err: any) {
      console.error('Load actions failed:', err);
      setActionsError(err?.message || 'Failed to load actions');
    } finally {
      setActionsLoading(false);
    }
  };

  useEffect(() => {
    loadDebtor();
    loadDocuments();
    loadDebts();
    loadCommunications();
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    } catch (err: any) {
      console.error('Upload failed:', err);
      setDocumentsError(err?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!window.confirm(`Delete document "${doc.file_name}"?`)) return;
    try {
      await localDB.deleteDocument(doc.id);
      await loadDocuments();
    } catch (err: any) {
      console.error('Delete document failed:', err);
      setDocumentsError(err?.message || 'Failed to delete document');
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
    } catch (err: any) {
      console.error('Delete debt failed:', err);
      setDebtsError(err?.message || 'Failed to delete debt');
    }
  };

  const handleDeleteCommunication = async (c: Communication) => {
    if (!window.confirm(`Delete this ${c.type} communication?`)) return;
    try {
      await localDB.deleteCommunication(c.id);
      await loadCommunications();
    } catch (err: any) {
      console.error('Delete communication failed:', err);
      setCommunicationsError(err?.message || 'Failed to delete communication');
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
    } catch (err: any) {
      console.error('Delete action failed:', err);
      setActionsError(err?.message || 'Failed to delete action');
    }
  };

  const handleDeleteDebtor = async () => {
    if (!debtor) return;
    const label = `${debtor.name} ${debtor.surname}`.trim();
    if (!window.confirm(`Delete debtor "${label}"? This also deletes their documents.`)) return;
    try {
      await localDB.deleteDebtor(debtor.id);
      navigate('/collections');
    } catch (err: any) {
      console.error('Delete debtor failed:', err);
      setError(err?.message || 'Failed to delete debtor');
    }
  };

  const handleSaved = async (updated: Debtor) => {
    setDebtor(updated);
    setShowEdit(false);
  };

  const formatBytes = (n: number): string => {
    if (!n) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  // ─── Styles ─────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#9ca3af',
    marginBottom: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '15px',
    color: '#111827',
    marginBottom: '14px',
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

  // ─── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{
          display: 'inline-block',
          width: '32px',
          height: '32px',
          border: '3px solid #f3f4f6',
          borderTop: '3px solid #7C3AED',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: '12px' }}>Loading debtor...</p>
      </div>
    );
  }

  if (error || !debtor) {
    return (
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <button onClick={() => navigate('/collections')} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Collections
        </button>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error || 'Debtor not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Back + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => navigate('/collections')} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Back to Collections
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowEdit(true)} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={handleDeleteDebtor}
            style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#dc2626', borderColor: '#fecaca' }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Header */}
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
        {debtor.surname}, {debtor.name}
      </h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>
        Debtor profile — stored locally on your machine
      </p>

      {/* Info card */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <span style={labelStyle}>Name</span>
            <div style={valueStyle}>{debtor.name}</div>
          </div>
          <div>
            <span style={labelStyle}>Surname</span>
            <div style={valueStyle}>{debtor.surname}</div>
          </div>
          <div>
            <span style={labelStyle}>Email</span>
            <div style={valueStyle}>{debtor.email || '—'}</div>
          </div>
          <div>
            <span style={labelStyle}>Phone</span>
            <div style={valueStyle}>{debtor.phone || '—'}</div>
          </div>
          <div>
            <span style={labelStyle}>Created</span>
            <div style={valueStyle}>{new Date(debtor.created_at).toLocaleString()}</div>
          </div>
          <div>
            <span style={labelStyle}>Updated</span>
            <div style={valueStyle}>{new Date(debtor.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Debts card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Debts
          </h2>
          <button onClick={openAddDebt} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '13px' }}>
            + Add Debt
          </button>
        </div>

        {debtsError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
            {debtsError}
          </div>
        )}

        {debtsLoading ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading debts...</p>
        ) : debts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            No debts recorded yet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {debts.map((d) => (
              <li key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
                marginBottom: '6px', fontSize: '13px'
              }}>
                <span style={{ fontWeight: 600, color: '#111827', minWidth: '120px' }}>
                  {d.amount.toLocaleString()} {d.currency}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  background: d.status === 'PAID' ? '#D1FAE5' : d.status === 'OVERDUE' ? '#FEE2E2' : '#F4F0FF',
                  color: d.status === 'PAID' ? '#065F46' : d.status === 'OVERDUE' ? '#991B1B' : '#7C3AED'
                }}>
                  {d.status}
                </span>
                <span style={{ flex: 1, color: '#4b5563' }}>
                  {d.description || '—'}
                  {d.due_date && ` · due ${new Date(d.due_date).toLocaleDateString()}`}
                </span>
                <button
                  onClick={() => openEditDebt(d)}
                  title="Edit debt"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteDebt(d)}
                  title="Delete debt"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Communications card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Communications
          </h2>
          <button
            onClick={() => setShowCommunicationForm(true)}
            style={{ ...btnPrimary, padding: '6px 12px', fontSize: '13px' }}
          >
            + Log Communication
          </button>
        </div>

        {communicationsError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
            {communicationsError}
          </div>
        )}

        {communicationsLoading ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading communications...</p>
        ) : communications.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            No communications logged yet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {communications.map((c) => (
              <li key={c.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
                marginBottom: '6px', fontSize: '13px'
              }}>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  background: '#F4F0FF', color: '#7C3AED', whiteSpace: 'nowrap'
                }}>
                  {c.type}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  background: c.direction === 'INBOUND' ? '#DBEAFE' : '#FEF3C7',
                  color: c.direction === 'INBOUND' ? '#1E40AF' : '#92400E',
                  whiteSpace: 'nowrap'
                }}>
                  {c.direction}
                </span>
                <span style={{ flex: 1, color: '#4b5563', wordBreak: 'break-word' }}>
                  {c.content || '—'}
                  {c.duration != null && ` · ${c.duration}s`}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {new Date(c.created_at).toLocaleString()}
                </span>
                <button
                  onClick={() => handleDeleteCommunication(c)}
                  title="Delete communication"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
            Actions
          </h2>
          <button
            onClick={openAddAction}
            style={{ ...btnPrimary, padding: '6px 12px', fontSize: '13px' }}
          >
            + Add Action
          </button>
        </div>

        {actionsError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
            {actionsError}
          </div>
        )}

        {actionsLoading ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading actions...</p>
        ) : actions.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            No actions recorded yet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {actions.map((a) => (
              <li key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
                marginBottom: '6px', fontSize: '13px'
              }}>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  background: a.type === 'LEGAL' ? '#FEE2E2' : '#F4F0FF',
                  color: a.type === 'LEGAL' ? '#991B1B' : '#7C3AED',
                  whiteSpace: 'nowrap'
                }}>
                  {a.type}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  background: a.status === 'COMPLETED' ? '#D1FAE5' : a.status === 'CANCELLED' ? '#F3F4F6' : a.status === 'IN_PROGRESS' ? '#DBEAFE' : '#FEF3C7',
                  color: a.status === 'COMPLETED' ? '#065F46' : a.status === 'CANCELLED' ? '#4B5563' : a.status === 'IN_PROGRESS' ? '#1E40AF' : '#92400E',
                  whiteSpace: 'nowrap'
                }}>
                  {a.status}
                </span>
                <span style={{ flex: 1, color: '#4b5563', wordBreak: 'break-word' }}>
                  {a.description || '—'}
                  {a.due_date && ` · due ${new Date(a.due_date).toLocaleDateString()}`}
                  {a.assigned_to && ` · ${a.assigned_to}`}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <button
                  onClick={() => openEditAction(a)}
                  title="Edit action"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteAction(a)}
                  title="Delete action"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documents card */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
          Documents
        </h2>

        {documentsError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
            {documentsError}
          </div>
        )}

        {documentsLoading ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading documents...</p>
        ) : documents.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px 0' }}>
            No documents yet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0' }}>
            {documents.map((doc) => (
              <li key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px',
                marginBottom: '6px', fontSize: '13px'
              }}>
                <FileText size={14} style={{ color: '#7C3AED' }} />
                <span style={{ flex: 1, color: '#111827' }}>{doc.file_name}</span>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                  {doc.category} · {formatBytes(doc.file_size)}
                </span>
                <button
                  onClick={() => handleDeleteDocument(doc)}
                  title="Delete document"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              width: '200px'
            }}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label style={{
            ...btnGhost,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            opacity: uploading ? 0.6 : 1, cursor: uploading ? 'default' : 'pointer'
          }}>
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Choose file'}
            <input
              type="file"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadDocument(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* Debtor edit modal */}
      {showEdit && (
        <DebtorEditModal
          editingId={debtor.id}
          initial={debtor}
          onSaved={handleSaved}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Debt edit modal */}
      {showDebtForm && id && (
        <DebtEditModal
          debtorId={id}
          editingId={editingDebtId}
          initial={editingDebt}
          onSaved={handleDebtSaved}
          onClose={closeDebtForm}
        />
      )}

      {/* Communication edit modal */}
      {showCommunicationForm && id && (
        <CommunicationEditModal
          debtorId={id}
          onSaved={async () => {
            setShowCommunicationForm(false);
            await loadCommunications();
          }}
          onClose={() => setShowCommunicationForm(false)}
        />
      )}

      {/* Action edit modal */}
      {showActionForm && id && (
        <ActionEditModal
          debtorId={id}
          editingId={editingActionId}
          initial={editingAction}
          onSaved={handleActionSaved}
          onClose={closeActionForm}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DebtorDetail;