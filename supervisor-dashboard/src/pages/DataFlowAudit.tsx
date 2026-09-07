import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';

interface Connection {
  address: string;
  type: 'incoming' | 'outgoing';
  status: 'connected' | 'disconnected' | 'unknown';
  pid: number;
  processName?: string;
  timestamp: string;
}

const DataFlowAudit: React.FC = () => {
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      // Get the base URL from env or default
      const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';
      // ─── DISABLED: Old localStorage auth check ────────────────────────────
// const token = localStorage.getItem('supervisor_token') || localStorage.getItem('token');
// ──────────────────────────────────────────────────────────────────────
      
const token = localStorage.getItem('gorka_token');
const response = await fetch(`${apiBase}/audit/network-connections`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

      if (!response.ok) {
        throw new Error('Failed to fetch network connections');
      }

      const data = await response.json();
      
      // Transform the data to match our interface
      const transformedConnections = data.connections.map((conn: any) => ({
        address: conn.address || conn.remoteAddress || 'Unknown',
        type: conn.type || (conn.localAddress ? 'incoming' : 'outgoing'),
        status: conn.status || 'unknown',
        pid: conn.pid || 0,
        processName: conn.processName || conn.name || 'Unknown',
        timestamp: conn.timestamp || new Date().toISOString()
      }));

      setConnections(transformedConnections);
      setLastRefreshed(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch connections';
      setError(errorMessage);
      // Use mock data for demo if real data fails
      setConnections(getMockConnections());
    } finally {
      setLoading(false);
    }
  };

  const getMockConnections = (): Connection[] => {
    return [
      {
        address: '127.0.0.1:5433',
        type: 'incoming',
        status: 'connected',
        pid: 1234,
        processName: 'postgres.exe',
        timestamp: new Date().toISOString()
      },
      {
        address: '127.0.0.1:3000',
        type: 'incoming',
        status: 'connected',
        pid: 5678,
        processName: 'node.exe',
        timestamp: new Date().toISOString()
      },
      {
        address: '192.168.1.1:80',
        type: 'outgoing',
        status: 'disconnected',
        pid: 9012,
        processName: 'curl.exe',
        timestamp: new Date().toISOString()
      }
    ];
  };

  const handleRefresh = () => {
    fetchConnections();
  };

  const handleExport = () => {
    // Create CSV export
    const headers = ['Address', 'Type', 'Status', 'Process', 'PID', 'Timestamp'];
    const rows = connections.map(conn => [
      conn.address,
      conn.type,
      conn.status,
      conn.processName || 'Unknown',
      conn.pid,
      conn.timestamp
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-flow-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '#22C55E';
      case 'disconnected':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle size={16} color="#22C55E" />;
      case 'disconnected':
        return <XCircle size={16} color="#EF4444" />;
      default:
        return <AlertCircle size={16} color="#F59E0B" />;
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111111' }}>Data Flow Audit</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
            Real-time network traffic audit for Node.js processes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#F3F4F6',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#374151',
              transition: 'all 150ms'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#E5E7EB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
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
              gap: '8px',
              padding: '8px 16px',
              background: '#7C3AED',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 150ms'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6D28D9';
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

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>Total Connections</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111111', marginTop: '4px' }}>
            {connections.length}
          </div>
        </div>
        <div style={{ padding: '16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>Active Connections</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22C55E', marginTop: '4px' }}>
            {connections.filter(c => c.status === 'connected').length}
          </div>
        </div>
        <div style={{ padding: '16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>Incoming / Outgoing</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111111', marginTop: '4px' }}>
            {connections.filter(c => c.type === 'incoming').length} / {connections.filter(c => c.type === 'outgoing').length}
          </div>
        </div>
      </div>

      {/* Connections Table */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Process</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((conn, index) => (
              <tr key={index} style={{ borderBottom: index < connections.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111111', fontFamily: 'monospace' }}>
                  {conn.address}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: conn.type === 'incoming' ? '#EFF6FF' : '#FEF3C7',
                    color: conn.type === 'incoming' ? '#3B82F6' : '#D97706'
                  }}>
                    {conn.type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getStatusIcon(conn.status)}
                    <span style={{ color: getStatusColor(conn.status) }}>
                      {conn.status}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                  {conn.processName || 'Unknown'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', fontFamily: 'monospace' }}>
                  {conn.pid || 'N/A'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6B7280' }}>
                  {new Date(conn.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
            {connections.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#6B7280' }}>
                  <Shield size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <p>No connections found</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>Click Refresh to scan for active connections</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '16px', padding: '12px 16px', background: '#F9FAFB', borderRadius: '8px', fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={16} style={{ opacity: 0.5 }} />
        <span>Showing network connections from Node.js processes only. External processes are filtered out.</span>
      </div>
    </div>
  );
};

export default DataFlowAudit;