import React, { useState } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';

interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED';
  dueDate: string;
  invoiceNumber: string;
}

interface PastDueClient {
  id: string;
  name: string;
  amount: number;
  daysOverdue: number;
  plan: string;
}

const BillingPage: React.FC = () => {
  const [dateRange] = useState('LAST_30_DAYS');

  // Revenue KPI data
  const mrr = 24500;
  const arr = 294000;
  const totalCollected = 142300;
  const outstanding = 2400;

  // Clients by plan
  const plans = [
    { name: 'Enterprise', count: 4, revenue: 16000, debtors: 89000 },
    { name: 'Pro', count: 22, revenue: 55000, debtors: 156000 },
    { name: 'Starter', count: 16, revenue: 6400, debtors: 32400 },
    { name: 'Trial', count: 3, revenue: 0, debtors: 1200 },
  ];

  // Past due clients
  const pastDueClients: PastDueClient[] = [
    { id: '1', name: 'Bank Delta', amount: 900, daysOverdue: 15, plan: 'Pro' },
    { id: '2', name: 'Agency Zulu', amount: 500, daysOverdue: 8, plan: 'Starter' },
    { id: '3', name: 'Finance Corp', amount: 1200, daysOverdue: 3, plan: 'Enterprise' },
  ];

  // Recent invoices
  const recentInvoices: Invoice[] = [
    { id: '1', clientName: 'Agency Alpha', amount: 2500, status: 'PAID', dueDate: '2026-08-01', invoiceNumber: 'INV-00123' },
    { id: '2', clientName: 'Bank Bravo', amount: 1800, status: 'PAID', dueDate: '2026-08-01', invoiceNumber: 'INV-00124' },
    { id: '3', clientName: 'Agency Charlie', amount: 0, status: 'PENDING', dueDate: '2026-09-01', invoiceNumber: 'INV-00125' },
    { id: '4', clientName: 'Bank Delta', amount: 900, status: 'OVERDUE', dueDate: '2026-07-15', invoiceNumber: 'INV-00126' },
    { id: '5', clientName: 'Agency Echo', amount: 400, status: 'PAID', dueDate: '2026-08-01', invoiceNumber: 'INV-00127' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return { color: '#22C55E', bg: '#DCFCE7', label: '✅ Paid' };
      case 'PENDING': return { color: '#EAB308', bg: '#FEF9C3', label: '⏳ Pending' };
      case 'OVERDUE': return { color: '#EF4444', bg: '#FEE2E2', label: '🔴 Overdue' };
      case 'FAILED': return { color: '#EF4444', bg: '#FEE2E2', label: '❌ Failed' };
      default: return { color: '#6B7280', bg: '#F3F4F6', label: 'Unknown' };
    }
  };

  // Calculate totals from plans
  const totalClients = plans.reduce((sum, p) => sum + p.count, 0);
  const totalRevenue = plans.reduce((sum, p) => sum + p.revenue, 0);

  // Revenue chart data (monthly)
  const revenueData = [
    { month: 'Jan', revenue: 8500 },
    { month: 'Feb', revenue: 10200 },
    { month: 'Mar', revenue: 11800 },
    { month: 'Apr', revenue: 14200 },
    { month: 'May', revenue: 16800 },
    { month: 'Jun', revenue: 19500 },
    { month: 'Jul', revenue: 22500 },
    { month: 'Aug', revenue: 24500 },
  ];

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));
  const getBarHeight = (value: number) => {
    return Math.max(4, (value / maxRevenue) * 120);
  };

  // Calculate percentage for plan distribution
  const getPlanPercentage = (count: number) => {
    return ((count / totalClients) * 100).toFixed(0);
  };

  return (
    <OwnerAppShell>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111' }}>
            Billing & Subscriptions
          </h2>
          <select
            value={dateRange}
            onChange={() => {}}
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
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="LAST_90_DAYS">Last 90 Days</option>
            <option value="YTD">Year to Date</option>
          </select>
        </div>

        {/* Revenue KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Revenue (MRR)</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${mrr.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#22C55E', marginTop: '4px' }}>↑ 22% from last month</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Annual Revenue (ARR)</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${arr.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Projected annual run rate</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Collected</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111111', marginTop: '4px' }}>${totalCollected.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>All-time revenue collected</div>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Balance</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#EF4444', marginTop: '4px' }}>${outstanding.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>⚠️ {pastDueClients.length} clients past due</div>
          </div>
        </div>

        {/* Two Column Layout: Revenue Chart + Plans Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Revenue Chart */}
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Monthly Revenue Trends</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '160px', gap: '8px', paddingBottom: '4px' }}>
              {revenueData.map((data, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '100%',
                    maxWidth: '28px',
                    height: `${getBarHeight(data.revenue)}px`,
                    backgroundColor: '#7C3AED',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <span style={{ fontSize: '10px', color: '#6B7280', marginTop: '6px' }}>{data.month}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              <span>${revenueData[0]?.revenue.toLocaleString()}</span>
              <span>${revenueData[revenueData.length - 1]?.revenue.toLocaleString()}</span>
            </div>
          </div>

          {/* Clients by Plan */}
          <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', marginBottom: '16px' }}>Clients by Plan</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Plan</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Clients</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Revenue</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Debtors</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{plan.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {plan.count}
                      <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: '4px' }}>
                        ({getPlanPercentage(plan.count)}%)
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>${plan.revenue.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{plan.debtors.toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #E3E3E3', fontWeight: '600' }}>
                  <td style={{ padding: '8px 12px' }}>Total</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{totalClients}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>${totalRevenue.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{plans.reduce((sum, p) => sum + p.debtors, 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Past Due Clients */}
        {pastDueClients.length > 0 && (
          <div style={{ backgroundColor: 'white', border: '1px solid #EF4444', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#EF4444', margin: 0 }}>
                ⚠️ Past Due Clients ({pastDueClients.length})
              </h4>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>Action required</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Client</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Amount</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Days Overdue</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Plan</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '500', color: '#6B7280' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pastDueClients.map((client) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{client.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>${client.amount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#EF4444', fontWeight: '600' }}>
                      {client.daysOverdue} days
                    </td>
                    <td style={{ padding: '8px 12px' }}>{client.plan}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button style={{
                        padding: '4px 12px',
                        border: '1px solid #E3E3E3',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#4A4A4A'
                      }}>
                        Send Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Invoices */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E3E3E3', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111111', margin: 0 }}>Recent Invoices</h4>
            <button style={{
              padding: '4px 12px',
              border: '1px solid #E3E3E3',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#4A4A4A'
            }}>
              View All
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Invoice #</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Client</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#6B7280' }}>Amount</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => {
                const statusColors = getStatusColor(invoice.status);
                return (
                  <tr key={invoice.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '500' }}>{invoice.invoiceNumber}</td>
                    <td style={{ padding: '8px 12px' }}>{invoice.clientName}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>${invoice.amount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: statusColors.bg,
                        color: statusColors.color
                      }}>
                        {statusColors.label}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default BillingPage;