import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerAppShell from '../components/OwnerAppShell';
import type { Client } from '../services/api';
import { getClients } from '../services/api';

const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  };

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return { color: '#22C55E', bg: '#DCFCE7' };
    case 'PENDING_REVIEW': return { color: '#EAB308', bg: '#FEF9C3' };
    case 'PENDING_EMAIL': return { color: '#F97316', bg: '#FFEDD5' };
    case 'SUSPENDED': return { color: '#EF4444', bg: '#FEE2E2' };
    case 'REJECTED': return { color: '#9CA3AF', bg: '#F3F4F6' };
    default: return { color: '#6B7280', bg: '#F3F4F6' };
  }
};

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'ENTERPRISE': return '#7C3AED';
      case 'PRO': return '#2563EB';
      case 'STARTER': return '#059669';
      case 'FREE': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || client.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading clients...</div>
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
            onClick={loadClients}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
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
            Clients
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#4A4A4A', alignSelf: 'center' }}>
              Total: {filteredClients.length}
            </span>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />

<select
  value={filterStatus}
  onChange={(e) => setFilterStatus(e.target.value)}
  style={{
    padding: '8px 14px',
    border: '1px solid #E3E3E3',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    outline: 'none',
    cursor: 'pointer'
  }}
>
  <option value="ALL">All Status</option>
  <option value="ACTIVE">Active</option>
  <option value="PENDING_REVIEW">Pending Review</option>
  <option value="PENDING_EMAIL">Pending Email</option>
  <option value="SUSPENDED">Suspended</option>
  <option value="REJECTED">Rejected</option>
</select>
        </div>

        {/* Clients Table */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E3E3E3'
              }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Client Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Debtors</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Agents</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Plan</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Revenue</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Last Sync</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const statusColors = getStatusColor(client.status);
                  return (
                    <tr key={client.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111111' }}>
                        {client.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: statusColors.bg,
                          color: statusColors.color
                        }}>
                          {client.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111111' }}>
                        {client.totalDebtors?.toLocaleString() || 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111111' }}>
                        {client.totalAgents || 0}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: '#F3F4F6',
                          color: getPlanColor(client.plan)
                        }}>
                          {client.plan}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#111111' }}>
                        ${(client.revenue || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px' }}>
                        {client.lastSync ? new Date(client.lastSync).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          style={{
                            padding: '4px 12px',
                            border: '1px solid #E3E3E3',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#4A4A4A'
                          }}
                          onClick={() => navigate(`/clients/${client.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default ClientsPage;