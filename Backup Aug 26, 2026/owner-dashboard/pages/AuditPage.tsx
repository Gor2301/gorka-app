import React, { useState } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityName: string;
  details: string;
  ipAddress: string;
}

const AuditPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Mock audit log data
  const auditLogs: AuditLog[] = [
    {
      id: '1',
      timestamp: '2026-08-24T14:30:00Z',
      user: 'Sarah Johnson',
      userEmail: 'sarah@agencyalpha.com',
      action: 'CLIENT_VIEWED',
      entityType: 'Client',
      entityName: 'Agency Alpha',
      details: 'Viewed client details',
      ipAddress: '192.168.1.100'
    },
    {
      id: '2',
      timestamp: '2026-08-24T14:15:00Z',
      user: 'Mike Roberts',
      userEmail: 'mike@bankbravo.com',
      action: 'EXPORT_CSV',
      entityType: 'Debtors',
      entityName: 'Bank Bravo',
      details: 'Exported 1,200 debtor records',
      ipAddress: '192.168.1.101'
    },
    {
      id: '3',
      timestamp: '2026-08-24T13:45:00Z',
      user: 'Lisa Chen',
      userEmail: 'lisa@agencycharlie.com',
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityName: 'Lisa Chen',
      details: 'Successful login',
      ipAddress: '192.168.1.102'
    },
    {
      id: '4',
      timestamp: '2026-08-24T13:30:00Z',
      user: 'David Park',
      userEmail: 'david@bankdelta.com',
      action: 'SUSPEND_CLIENT',
      entityType: 'Client',
      entityName: 'Bank Delta',
      details: 'Client suspended due to payment overdue',
      ipAddress: '192.168.1.103'
    },
    {
      id: '5',
      timestamp: '2026-08-24T13:00:00Z',
      user: 'Sarah Johnson',
      userEmail: 'sarah@agencyalpha.com',
      action: 'CONNECTOR_TESTED',
      entityType: 'Connector',
      entityName: 'Pipl People Search',
      details: 'Test connection successful',
      ipAddress: '192.168.1.100'
    },
    {
      id: '6',
      timestamp: '2026-08-24T12:30:00Z',
      user: 'John Smith',
      userEmail: 'john@agencyecho.com',
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityName: 'John Smith',
      details: 'Failed login attempt - invalid password',
      ipAddress: '192.168.1.104'
    },
    {
      id: '7',
      timestamp: '2026-08-24T12:00:00Z',
      user: 'Mike Roberts',
      userEmail: 'mike@bankbravo.com',
      action: 'AI_RECOMMENDATION_ACCEPTED',
      entityType: 'AI Copilot',
      entityName: 'Debtor #4521',
      details: 'AI recommendation accepted: Send firm email',
      ipAddress: '192.168.1.101'
    },
    {
      id: '8',
      timestamp: '2026-08-24T11:30:00Z',
      user: 'Lisa Chen',
      userEmail: 'lisa@agencycharlie.com',
      action: 'PERMISSION_CHANGED',
      entityType: 'User',
      entityName: 'Agent Tom Wilson',
      details: 'Role changed from Agent to Supervisor',
      ipAddress: '192.168.1.102'
    },
  ];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
      case 'LOGIN_FAILED':
        return { color: '#2563EB', bg: '#DBEAFE' };
      case 'CLIENT_VIEWED':
        return { color: '#7C3AED', bg: '#F4F0FF' };
      case 'EXPORT_CSV':
        return { color: '#F97316', bg: '#FFEDD5' };
      case 'SUSPEND_CLIENT':
        return { color: '#EF4444', bg: '#FEE2E2' };
      case 'CONNECTOR_TESTED':
        return { color: '#059669', bg: '#D1FAE5' };
      case 'AI_RECOMMENDATION_ACCEPTED':
        return { color: '#7C3AED', bg: '#F4F0FF' };
      case 'PERMISSION_CHANGED':
        return { color: '#EAB308', bg: '#FEF9C3' };
      default:
        return { color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  // Get unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action)));

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(log.timestamp) >= new Date(dateFrom);
    }
    if (dateTo) {
      matchesDate = matchesDate && new Date(log.timestamp) <= new Date(dateTo);
    }
    
    return matchesSearch && matchesAction && matchesDate;
  });

  const handleExport = () => {
    alert('🔒 Export functionality: Would generate encrypted CSV with password protection');
  };

  return (
    <OwnerAppShell>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111' }}>
            Audit Logs
          </h2>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 20px',
              backgroundColor: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📥 Export Audit Log
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '16px'
        }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by user, entity, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 2,
              minWidth: '200px',
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none',
              cursor: 'pointer',
              flex: 1,
              minWidth: '150px'
            }}
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              flex: 0.5,
              minWidth: '120px'
            }}
          />

          {/* Date To */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              flex: 0.5,
              minWidth: '120px'
            }}
          />

          {/* Clear Filters */}
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterAction('ALL');
              setDateFrom('');
              setDateTo('');
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

        {/* Results Count */}
        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#6B7280' }}>
          Showing {filteredLogs.length} of {auditLogs.length} entries
        </div>

        {/* Audit Log Table */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E3E3E3'
              }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>User</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Action</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Entity</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Details</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                    No audit logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionColors = getActionColor(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '12px' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '500', color: '#111111' }}>{log.user}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{log.userEmail}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: actionColors.bg,
                          color: actionColors.color
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '500', color: '#111111' }}>{log.entityName}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{log.entityType}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4A4A4A', maxWidth: '200px' }}>
                        {log.details}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '12px' }}>
                        {log.ipAddress}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Export Info */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E3E3E3',
          fontSize: '12px',
          color: '#6B7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔒</span>
          <span>
            Exports are encrypted (AES-256) and password-protected. All exports are logged and audited.
            Audit logs are retained for 2 years.
          </span>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default AuditPage;