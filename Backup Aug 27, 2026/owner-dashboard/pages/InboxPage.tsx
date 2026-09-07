import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerAppShell from '../components/OwnerAppShell';
import { Inbox, RefreshCw, Eye } from 'lucide-react';

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
  readAt: string | null;
  openedBy: string;
  openedByEmail: string;
  organization: {
    id: string;
    name: string;
  } | null;
}

const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadTickets();
    loadUnreadCount();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/support/tickets/personal', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load inbox');
      }

      setTickets(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/support/tickets/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setUnreadCount(data.data?.count || 0);
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  const markAsRead = async (ticketId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/support/tickets/${ticketId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // Update local state
      setTickets(tickets.map(t => 
        t.id === ticketId ? { ...t, readAt: new Date().toISOString() } : t
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleViewTicket = async (ticketId: string) => {
    // Mark as read when viewing
    await markAsRead(ticketId);
    navigate(`/inbox/${ticketId}`);
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
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading inbox...</div>
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
      </OwnerAppShell>
    );
  }

  return (
    <OwnerAppShell>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Inbox size={28} color="#7C3AED" />
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
              Inbox
            </h2>
            {unreadCount > 0 && (
              <span style={{
                backgroundColor: '#EF4444',
                color: 'white',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <button
            onClick={() => { loadTickets(); loadUnreadCount(); }}
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
            <Inbox size={48} color="#9CA3AF" />
            <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111111', marginTop: '16px' }}>
              Inbox is empty
            </h3>
            <p style={{ color: '#6B7280' }}>
              No personal tickets from SuperAdmins yet.
            </p>
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
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>From</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Priority</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Received</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const statusColors = getStatusColor(ticket.status);
                  const isUnread = ticket.readAt === null;
                  return (
                    <tr key={ticket.id} style={{
                      borderBottom: '1px solid #F3F4F6',
                      backgroundColor: isUnread ? '#F8FAFC' : 'white',
                      fontWeight: isUnread ? '500' : '400'
                    }}>
                      <td style={{ padding: '12px 16px', color: '#111111' }}>
                        {formatTicketNumber(ticket.ticketNumber)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#111111' }}>
                        {ticket.subject}
                        {isUnread && (
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '8px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#3B82F6',
                            borderRadius: '50%'
                          }} />
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>
                        {ticket.organization?.name || ticket.openedByEmail}
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
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            border: '1px solid #E3E3E3',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#4A4A4A',
                            margin: '0 auto'
                          }}
                          onClick={() => handleViewTicket(ticket.id)}
                        >
                          <Eye size={14} />
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
    </OwnerAppShell>
  );
};

export default InboxPage;