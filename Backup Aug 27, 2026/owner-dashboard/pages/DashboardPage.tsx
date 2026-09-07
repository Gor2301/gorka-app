import React, { useState, useEffect } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';
import { getDashboardStats } from '../services/api';

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalDebtors: 0,
    totalDebt: 0,
    monthlyRevenue: 0,
    clientGrowth: 0,
    revenueGrowth: 0,
    debtorGrowth: 0,
    debtGrowth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <OwnerAppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div>Loading dashboard...</div>
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
            onClick={loadDashboardData}
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
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', marginBottom: '24px' }}>
          Platform Overview
        </h2>
        
        {/* 5 KPI Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Total Clients */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#4A4A4A', marginBottom: '4px' }}>Total Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>{stats.totalClients}</div>
            <div style={{ fontSize: '12px', color: stats.clientGrowth >= 0 ? '#22C55E' : '#EF4444', marginTop: '4px' }}>
              {stats.clientGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.clientGrowth)}% from last month
            </div>
          </div>
          
          {/* Card 2: Active Clients */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#4A4A4A', marginBottom: '4px' }}>Active Clients</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>{stats.activeClients}</div>
            <div style={{ fontSize: '12px', color: '#4A4A4A', marginTop: '4px' }}>
              {stats.totalClients > 0 ? Math.round((stats.activeClients / stats.totalClients) * 100) : 0}% of total
            </div>
          </div>
          
          {/* Card 3: Total Debtors */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#4A4A4A', marginBottom: '4px' }}>Total Debtors</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>{(stats.totalDebtors || 0).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: stats.debtorGrowth >= 0 ? '#22C55E' : '#EF4444', marginTop: '4px' }}>
              {stats.debtorGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.debtorGrowth)}% from last month
            </div>
          </div>
          
          {/* Card 4: Total Debt */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#4A4A4A', marginBottom: '4px' }}>Total Debt</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>${(stats.totalDebt || 0).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: stats.debtGrowth >= 0 ? '#22C55E' : '#EF4444', marginTop: '4px' }}>
              {stats.debtGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.debtGrowth || 0)}% from last month
            </div>
          </div>
          
          {/* Card 5: Monthly Revenue */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E3E3E3',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#4A4A4A', marginBottom: '4px' }}>Monthly Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>${(stats.monthlyRevenue || 0).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: stats.revenueGrowth >= 0 ? '#22C55E' : '#EF4444', marginTop: '4px' }}>
              {stats.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.revenueGrowth)}% from last month
            </div>
          </div>
        </div>
        
        {/* Placeholder for future charts */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          color: '#4A4A4A'
        }}>
          <p style={{ margin: 0 }}>📊 Charts and detailed analytics coming soon</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#999' }}>
            System health, client growth, and revenue trends will appear here
          </p>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default DashboardPage;