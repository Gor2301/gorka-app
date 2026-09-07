import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  Activity,
  RefreshCw
} from 'lucide-react';
import { auditService } from '../services/audit.service';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  details: any;
  createdAt: string;
}

const Audit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
// ─── DISABLED: Old localStorage auth check ────────────────────────────
// const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
// if (!token) {
//   // handle error
//   return;
// }
// ──────────────────────────────────────────────────────────────────────

      const response = await auditService.getAuditLogs(page, limit, search);
      
      if (response && response.success) {
        const data = response.data || [];
        const count = response.count || response.total || 0;
        const pages = response.totalPages || Math.ceil(count / limit);
        
        setLogs(Array.isArray(data) ? data : []);
        setTotal(count);
        setTotalPages(pages);
      } else {
        setLogs([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to load audit logs');
      setLogs([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleExport = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
    if (!token) return;
    window.open(`http://127.0.0.1:3000/api/audit/export/csv?search=${search}`, '_blank');
  };

  const handleRefresh = () => fetchLogs();

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: '#10b981',
      UPDATE: '#3b82f6',
      DELETE: '#ef4444',
      LOGIN: '#8b5cf6',
      LOGOUT: '#6b7280',
      EXPORT: '#f59e0b',
      UPLOAD: '#6366f1',
      PERMISSION_CHANGE: '#ec4899',
    };
    return colors[action] || '#6b7280';
  };

  const getActionBg = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: '#d1fae5',
      UPDATE: '#dbeafe',
      DELETE: '#fee2e2',
      LOGIN: '#ede9fe',
      LOGOUT: '#f3f4f6',
      EXPORT: '#fef3c7',
      UPLOAD: '#e0e7ff',
      PERMISSION_CHANGE: '#fce7f3',
    };
    return colors[action] || '#f3f4f6';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #7C3AED',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#6b7280', marginTop: '16px' }}>Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Audit Logs</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
            View all activity across the platform
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6d28d9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#7C3AED';
            }}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: '#9ca3af' 
          }} size={18} />
          <input
            type="text"
            placeholder="Search by user or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          style={{
            padding: '10px 20px',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#374151',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
        >
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          color: '#dc2626', 
          padding: '12px 16px', 
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        marginBottom: '16px',
        fontSize: '14px',
        color: '#6b7280'
      }}>
        <span>Total: <strong style={{ color: '#111827' }}>{total}</strong> logs</span>
        {total > 0 && (
          <span>Page <strong style={{ color: '#111827' }}>{page}</strong> of <strong style={{ color: '#111827' }}>{totalPages}</strong></span>
        )}
      </div>

      {/* Logs Table */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resource</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IP Address</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>View</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(logs) && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: getActionBg(log.action),
                        color: getActionColor(log.action),
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500', color: '#111827' }}>{log.userName || 'Unknown'}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{log.userEmail || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#374151' }}>{log.entityType || 'N/A'}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>ID: {log.entityId || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {log.ipAddress || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      <div>{formatDate(log.createdAt)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#7C3AED',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3e8ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>
                    <Activity size={32} style={{ margin: '0 auto 8px', color: '#d1d5db' }} />
                    <p>No audit logs found</p>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} results
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: 'white',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (page !== 1) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ padding: '8px 12px', fontSize: '14px', color: '#374151' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: 'white',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (page !== totalPages) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setSelectedLog(null)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Audit Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '20px',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>Action</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedLog.action}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>User</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedLog.userName || 'Unknown'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedLog.userEmail || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>Resource</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedLog.entityType || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>ID: {selectedLog.entityId || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>IP Address</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{selectedLog.ipAddress || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>Time</div>
                <div style={{ fontSize: '15px', color: '#111827' }}>{formatDate(selectedLog.createdAt)}</div>
              </div>
              {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', textTransform: 'uppercase' }}>Details</div>
                  <pre style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    overflowX: 'auto',
                    margin: 0,
                    border: '1px solid #f3f4f6',
                  }}>
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Audit;