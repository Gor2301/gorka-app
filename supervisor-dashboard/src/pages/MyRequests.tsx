import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, RefreshCw } from 'lucide-react';

interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  isPersonal: boolean;
  assignedTo: string | null;
}

const MyRequests: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      // ─── DISABLED: Old localStorage auth check ────────────────────────────
// const token = localStorage.getItem('token');
// ──────────────────────────────────────────────────────────────────────
const token = localStorage.getItem('gorka_token');
const response = await fetch('http://api.gorka.localhost:3000/api/support/tickets/my', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load your requests');
      }

      setTickets(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return { color: '#EAB308', bg: '#FEF9C3' };
      case 'IN_PROGRESS': return { color: '#2563EB', bg: '#DBEAFE' };
      case 'WAITING_FOR_CLIENT': return { color: '#F97316', bg: '#FFEDD5' };
      case 'RESOLVED': return { color: '#22C55E', bg: '#DCFCE7' };
      case 'CLOSED': return { color: '#9CA3AF', bg: '#F3F4F6' };
      default: return { color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return '#EF4444';
      case 'HIGH': return '#F97316';
      case 'MEDIUM': return '#EAB308';
      case 'LOW': return '#22C55E';
      default: return '#6B7280';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatTicketNumber = (num: number) => {
    return `GORKA-${String(num).padStart(6, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div>Loading your requests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#EF4444', marginBottom: '16px' }}>Error: {error}</div>
        <button
          onClick={loadTickets}
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
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LifeBuoy size={28} color="#7C3AED" />
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
            My Requests
          </h2>
          <span style={{
            fontSize: '12px',
            backgroundColor: '#F3F4F6',
            padding: '2px 12px',
            borderRadius: '12px',
            color: '#6B7280'
          }}>
            {tickets.length} total
          </span>
        </div>
        <button
          onClick={loadTickets}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            border: '1px solid #E3E3E3',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#4A4A4A'
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {tickets.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <LifeBuoy size={48} color="#9CA3AF" />
          <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111111', marginTop: '16px' }}>
            No requests yet
          </h3>
          <p style={{ color: '#6B7280', marginBottom: '16px' }}>
            You haven't submitted any support requests yet.
          </p>
          <button
            onClick={() => navigate('/support')}
            style={{
              padding: '8px 24px',
              backgroundColor: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Create Request
          </button>
        </div>
      ) : (
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Ticket</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Subject</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Priority</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Updated</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const statusColors = getStatusColor(ticket.status);
                return (
                  <tr key={ticket.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111111' }}>
                      {formatTicketNumber(ticket.ticketNumber)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#111111' }}>
                      {ticket.subject}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>
                      {ticket.category.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: getPriorityColor(ticket.priority) + '20',
                        color: getPriorityColor(ticket.priority)
                      }}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: statusColors.bg,
                        color: statusColors.color
                      }}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px' }}>
                      {formatDate(ticket.updatedAt)}
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
                        onClick={() => navigate(`/my-requests/${ticket.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyRequests;