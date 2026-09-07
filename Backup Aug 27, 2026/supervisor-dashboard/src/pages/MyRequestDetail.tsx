import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface Reply {
  id: string;
  message: string;
  isInternal: boolean;
  sentBy: string;
  sentByName: string | null;
  createdAt: string;
}

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
  replies: Reply[];
  openedBy: string;
  openedByEmail: string;
  openedByName: string | null;
}

const MyRequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No ticket ID provided');
      setLoading(false);
      return;
    }
    loadTicket();
  }, [id]);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('supervisor_token') || localStorage.getItem('token');
      
      if (!token) {
        setError('Please log in again');
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:3000/api/support/tickets/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load ticket');
      }

      setTicket(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
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
        <div>Loading ticket...</div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ color: '#EF4444', marginBottom: '16px' }}>Error: {error || 'Ticket not found'}</div>
        <button
          onClick={() => navigate('/my-requests')}
          style={{
            padding: '8px 16px',
            border: '1px solid #E3E3E3',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          Back to My Requests
        </button>
      </div>
    );
  }

  const statusColors = getStatusColor(ticket.status);

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/my-requests')}
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
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
          {formatTicketNumber(ticket.ticketNumber)}
        </h2>
        <span style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '500',
          backgroundColor: statusColors.bg,
          color: statusColors.color
        }}>
          {ticket.status.replace('_', ' ')}
        </span>
        <span style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '500',
          backgroundColor: getPriorityColor(ticket.priority) + '20',
          color: getPriorityColor(ticket.priority)
        }}>
          {ticket.priority}
        </span>
        <button
          onClick={loadTicket}
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
            color: '#4A4A4A',
            marginLeft: 'auto'
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Ticket Info */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #E3E3E3',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111111', margin: '0 0 8px 0' }}>
          {ticket.subject}
        </h3>
        <p style={{ fontSize: '14px', color: '#4A4A4A', margin: '0 0 16px 0' }}>
          {ticket.message}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
          <div>
            <span style={{ color: '#6B7280' }}>Category:</span>
            <span style={{ color: '#111111', marginLeft: '4px' }}>{ticket.category}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Created:</span>
            <span style={{ color: '#111111', marginLeft: '4px' }}>{formatDate(ticket.createdAt)}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Updated:</span>
            <span style={{ color: '#111111', marginLeft: '4px' }}>{formatDate(ticket.updatedAt)}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Assigned to:</span>
            <span style={{ color: '#111111', marginLeft: '4px' }}>{ticket.assignedTo || 'Not assigned'}</span>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #E3E3E3',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', margin: '0 0 16px 0' }}>
          Replies ({ticket.replies?.length || 0})
        </h4>
        
        {ticket.replies && ticket.replies.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ticket.replies.map((reply) => (
              <div
                key={reply.id}
                style={{
                  padding: '12px 16px',
                  backgroundColor: reply.isInternal ? '#FEF9C3' : '#F9FAFB',
                  borderRadius: '6px',
                  border: '1px solid #E3E3E3'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111111' }}>
                    {reply.sentByName || reply.sentBy}
                    {reply.isInternal && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#F97316',
                        backgroundColor: '#FFEDD5',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        INTERNAL
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    {formatDate(reply.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: '#4A4A4A', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {reply.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>No replies yet.</p>
        )}
      </div>
    </div>
  );
};

export default MyRequestDetail;