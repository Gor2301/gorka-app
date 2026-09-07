import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerAppShell from '../components/OwnerAppShell';
import { 
  getTickets, 
  getTicketStats, 
  type SupportTicket, 
  type TicketStats 
} from '../services/api';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [page, filterStatus, filterPriority, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketsData, statsData] = await Promise.all([
        getTickets({
          page,
          limit: 25,
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          priority: filterPriority !== 'ALL' ? filterPriority : undefined,
          search: searchTerm || undefined
        }),
        getTicketStats()
      ]);
      setTickets(ticketsData.tickets);
      setTotal(ticketsData.total);
      setTotalPages(ticketsData.totalPages);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
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

  if (loading && tickets.length === 0) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading support tickets...</div>
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
            onClick={loadData}
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
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111' }}>
            Support Tickets
          </h2>
          <span style={{ fontSize: '14px', color: '#4A4A4A' }}>
            Total: {total}
          </span>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Open</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#EAB308' }}>{stats.open}</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>In Progress</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563EB' }}>{stats.inProgress}</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Waiting</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#F97316' }}>{stats.waitingForClient}</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Resolved</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#22C55E' }}>{stats.resolved}</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Closed</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#9CA3AF' }}>{stats.closed}</div>
            </div>
            <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Total</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#111111' }}>{stats.total}</div>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
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
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_FOR_CLIENT">Waiting</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
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
            <option value="ALL">All Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('ALL');
              setFilterPriority('ALL');
              setPage(1);
            }}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#4A4A4A'
            }}
          >
            Clear Filters
          </button>
        </div>

        {/* Tickets Table */}
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Client</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Priority</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Updated</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
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
                          onClick={() => navigate(`/support/${ticket.id}`)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px'
          }}>
            <span style={{ fontSize: '14px', color: '#6B7280' }}>
              Showing {tickets.length} of {total} tickets
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #E3E3E3',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1,
                  fontSize: '13px'
                }}
              >
                Previous
              </button>
              <span style={{ padding: '6px 14px', fontSize: '13px', color: '#4A4A4A' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #E3E3E3',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.5 : 1,
                  fontSize: '13px'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </OwnerAppShell>
  );
};

export default SupportPage;