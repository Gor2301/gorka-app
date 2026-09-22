import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { localDB, Debtor } from '../services/local.db';
import DebtorEditModal from '../components/DebtorEditModal';

const Collections: React.FC = () => {
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
    } catch (err: any) {
      console.error('Error loading debtors:', err);
      setError(err?.message || 'Failed to load debtors');
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
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err?.message || 'Search failed');
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
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err?.message || 'Failed to delete debtor');
    }
  };

  const openDetail = (d: Debtor) => {
    navigate(`/collections/${d.id}`);
  };

  // ─── Styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
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

  const linkStyle: React.CSSProperties = {
    color: '#111827',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Collections</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
            Debtor records stored locally on your machine
          </p>
        </div>
        <button onClick={openAdd} style={btnPrimary}>
          <Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Add Debtor
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search by name, surname, email, phone..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '36px' }}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={loadDebtors} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
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
            <p style={{ marginTop: '12px' }}>Loading debtors...</p>
          </div>
        ) : debtors.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6b7280' }}>
            <Users size={40} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
            <p style={{ fontSize: '16px', fontWeight: 500, color: '#374151', margin: '0 0 4px 0' }}>
              {query ? 'No matching debtors' : 'No debtors yet'}
            </p>
            <p style={{ margin: 0 }}>
              {query ? 'Try a different search term.' : 'Click "Add Debtor" to create your first record.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      onClick={() => openDetail(d)}
                      style={linkStyle}
                      title="Open debtor profile"
                    >
                      {d.surname}, {d.name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>{d.email || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>{d.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => openEdit(d)}
                      title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', marginRight: '12px' }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                    >
                      <Trash2 size={16} />
                    </button>
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Collections;