 import React, { useState, useEffect } from 'react';
import { clientsService } from '../services/clients';
import type { Client } from '../services/clients';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchClients();
  }, [page, search]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await clientsService.getClients(page, 20, search || undefined);
      setClients(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4CAF50';
      case 'SUSPENDED': return '#FF9800';
      case 'ARCHIVED': return '#9E9E9E';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Loading clients...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Clients</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              width: '200px'
            }}
          />
          <span style={{ color: '#666', fontSize: '14px' }}>
            Total: {total}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ 
          background: '#fee', 
          color: '#c00', 
          padding: '12px', 
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <div style={{ 
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Users</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Debtors</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  No clients found
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>{client.name}</td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{client.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{client._count?.users || 0}</td>
                  <td style={{ padding: '12px 16px' }}>{client._count?.debtors || 0}</td>
                  <td style={{ padding: '12px 16px' }}>{client._count?.actions || 0}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: getStatusColor(client.status),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {client.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666', fontSize: '14px' }}>
                    {new Date(client.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '24px'
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: page === 1 ? '#eee' : '#F01428',
              color: page === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === 1 ? 'default' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: '#666' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px',
              background: page === totalPages ? '#eee' : '#F01428',
              color: page === totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === totalPages ? 'default' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Clients;