import React, { useState, useEffect } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';
import { getClients, getUsageMetrics } from '../services/api';
import type { Client } from '../services/api';

interface UsageData {
  month: string;
  clients: number;
  debtors: number;
  debt: number;
  revenue: number;
  aiCalls: number;
  communications: number;
}

const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('LAST_30_DAYS');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, usage] = await Promise.all([
        getClients(),
        getUsageMetrics().catch(() => null)
      ]);
      setClients(clientsData);
      setUsageData(usage);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate real metrics
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'ACTIVE').length;
  const totalDebtors = clients.reduce((sum, c) => sum + (c.totalDebtors || 0), 0);
  const totalDebt = clients.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const totalRevenue = clients.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const totalAgents = clients.reduce((sum, c) => sum + (c.totalAgents || 0), 0);

  // Monthly data (real current month + zeros for previous)
  const monthlyData: UsageData[] = [
    { month: 'Jan', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Feb', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Mar', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Apr', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'May', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Jun', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Jul', clients: 0, debtors: 0, debt: 0, revenue: 0, aiCalls: 0, communications: 0 },
    { month: 'Aug', clients: totalClients, debtors: totalDebtors, debt: totalDebt, revenue: totalRevenue, aiCalls: usageData?.aiCalls || 0, communications: (usageData?.emailsSent || 0) + (usageData?.smsSent || 0) },
  ];

  // Top clients (anonymized)
  const topClients = clients
    .map((c, index) => ({
      name: 'Client ' + String.fromCharCode(65 + index),
      debtors: c.totalDebtors || 0,
      debt: c.totalDebt || 0,
      agents: c.totalAgents || 0,
    }))
    .sort((a, b) => b.debtors - a.debtors)
    .slice(0, 5);

  const totalAICalls = usageData?.aiCalls || 0;
  const totalComms = (usageData?.emailsSent || 0) + (usageData?.smsSent || 0);

  // Chart calculations
  const maxDebtors = Math.max(...monthlyData.map(d => d.debtors), 1);
  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue), 1);
  const maxClients = Math.max(...monthlyData.map(d => d.clients), 1);

  const getBarHeight = (value: number, max: number) => {
    return Math.max(4, (value / max) * 120);
  };

  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading analytics...</div>
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
            Platform Analytics
          </h2>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
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
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="LAST_90_DAYS">Last 90 Days</option>
            <option value="YTD">Year to Date</option>
          </select>
        </div>

        {/* 5 KPI Cards — NEW: Added Total Debt */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Clients</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{totalClients}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{activeClients} active</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Debtors</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{totalDebtors.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Across all clients</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Debt</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${totalDebt.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>All clients combined</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Agents</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>{totalAgents}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Across all clients</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${totalRevenue.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>All-time</div>
          </div>
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Client Growth Chart */}
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Client Growth</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '8px', paddingBottom: '4px' }}>
              {monthlyData.map((data, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '100%',
                    maxWidth: '28px',
                    height: `${getBarHeight(data.clients, maxClients)}px`,
                    backgroundColor: '#7C3AED',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <span style={{ fontSize: '10px', color: '#6B7280', marginTop: '6px' }}>{data.month}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              <span>Clients: {monthlyData[0]?.clients || 0}</span>
              <span>Clients: {monthlyData[monthlyData.length - 1]?.clients || 0}</span>
            </div>
          </div>

          {/* Revenue Trends Chart */}
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Revenue Trends</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '8px', paddingBottom: '4px' }}>
              {monthlyData.map((data, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '100%',
                    maxWidth: '28px',
                    height: `${getBarHeight(data.revenue, maxRevenue)}px`,
                    backgroundColor: '#2563EB',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <span style={{ fontSize: '10px', color: '#6B7280', marginTop: '6px' }}>{data.month}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              <span>Revenue: ${monthlyData[0]?.revenue?.toLocaleString() || 0}</span>
              <span>Revenue: ${monthlyData[monthlyData.length - 1]?.revenue?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>

        {/* Usage Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Communication Volume</h4>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#7C3AED' }}>{totalComms.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Messages</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#22C55E' }}>{usageData?.emailsSent || 0}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Emails</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563EB' }}>{usageData?.smsSent || 0}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>SMS</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>AI Copilot Usage</h4>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#7C3AED' }}>{totalAICalls.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Total AI Calls</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#22C55E' }}>0%</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Success Rate</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563EB' }}>0s</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Avg Response</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Clients Table (Anonymized) — NEW: Added Total Debt */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', margin: 0 }}>Top Clients by Debtors</h4>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              🔒 Client names anonymized for privacy
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Client</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Debtors</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Total Debt</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Agents</th>
              </tr>
            </thead>
            <tbody>
              {topClients.length > 0 ? (
                topClients.map((client, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500', color: '#111111' }}>{client.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{client.debtors.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>${client.debt.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{client.agents}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default AnalyticsPage;