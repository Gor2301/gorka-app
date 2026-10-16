import React, { useState, useEffect } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';
import { getOrganizations } from '../services/api';
import type { OrganizationRow } from '../services/api';

const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
      console.error('Error loading organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const filtered = organizations.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading organizations...</div>
        </div>
      </OwnerAppShell>
    );
  }

  if (error) {
    return (
      <OwnerAppShell>
        <div style={{ padding: '24px' }}>
          <div style={{ color: '#EF4444', marginBottom: '16px' }}>Error: {error}</div>
          <button
            onClick={loadOrganizations}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </OwnerAppShell>
    );
  }

  return (
    <OwnerAppShell>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111' }}>
            Organizations
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name"
              style={{
                padding: '8px 12px',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '220px',
              }}
            />
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>
              {organizations.length === 0
                ? 'No organizations registered yet.'
                : 'No organizations match the search.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAFAFA' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Agents</th>
                  <th style={thStyle}>License</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #E3E3E3' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500, color: '#111111' }}>{o.name}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {o.verificationStatus}
                      </div>
                    </td>
                    <td style={tdStyle}>{o.clientType || '—'}</td>
                    <td style={tdStyle}>
                      <div>{o.contactEmail || '—'}</div>
                      {o.contactPhone && (
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {o.contactPhone}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>{formatDate(o.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '13px' }}>
                        <span style={pillStyle}>{o.agentCounts.registered} reg</span>{' '}
                        <span style={{ ...pillStyle, color: '#059669', backgroundColor: '#DCFCE7' }}>
                          {o.agentCounts.online} on
                        </span>{' '}
                        <span style={{ ...pillStyle, color: '#6B7280', backgroundColor: '#F3F4F6' }}>
                          {o.agentCounts.offline} off
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>{o.licenseStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '16px', fontSize: '13px', color: '#6B7280' }}>
          {filtered.length} of {organizations.length} organizations
        </div>
      </div>
    </OwnerAppShell>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '13px',
  fontWeight: '500',
  color: '#6B7280',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#111111',
  verticalAlign: 'top',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '12px',
  backgroundColor: '#F3F4F6',
  color: '#4A4A4A',
};

export default OrganizationsPage;