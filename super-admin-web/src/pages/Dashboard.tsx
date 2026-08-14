import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1/admin';

interface KPI {
  totalOrganizations: number;
  totalUsers: number;
  totalDebtors: number;
  totalActions: number;
  totalCommunications: number;
  totalAiRecommendations: number;
}

const Dashboard: React.FC = () => {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/analytics/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setKpis(data.data.kpis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Dashboard</h1>

      {error && (
        <div style={{ 
          background: '#fee', 
          color: '#c00', 
          padding: '12px', 
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>Organizations</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalOrganizations || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>Users</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalUsers || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>Debtors</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalDebtors || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>Actions</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalActions || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>Communications</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalCommunications || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#666', fontSize: '14px' }}>AI Recommendations</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#F01428' }}>{kpis?.totalAiRecommendations || 0}</div>
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Platform Overview</h2>
        <p style={{ color: '#666' }}>Welcome to the GORKA Super Admin Platform!</p>
        <p style={{ color: '#666' }}>
          Total organizations: <strong>{kpis?.totalOrganizations || 0}</strong>
        </p>
      </div>
    </div>
  );
};

export default Dashboard;