import React, { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Activity,
  UserCheck,
  Clock,
  ArrowRight
} from 'lucide-react';
import { localDB } from '../services/local.db';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  total_debtors: number;
  total_debt: number;
  total_actions: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    total_debtors: 0,
    total_debt: 0,
    total_actions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await localDB.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
      
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const cardStyle = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
          <p style={{ color: '#6b7280', marginTop: '16px' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '16px', borderRadius: '8px' }}>
          {error}
          <button 
            onClick={fetchDashboardStats}
            style={{ marginLeft: '16px', color: '#dc2626', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Total Agents card — deferred. No local source of truth. See spec D2.
  const cards = [
    {
      title: 'Total Debtors',
      value: stats.total_debtors,
      icon: Users,
      iconBg: '#f3e8ff',
      iconColor: '#7C3AED',
      path: '/collections',
      subtitle: 'Active debtors'
    },
    {
      title: 'Total Debt',
      value: formatCurrency(stats.total_debt),
      icon: DollarSign,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      path: '/collections',
      subtitle: 'Outstanding balance'
    },
    {
      title: 'Total Actions',
      value: stats.total_actions,
      icon: Activity,
      iconBg: '#ffedd5',
      iconColor: '#ea580c',
      path: '/audit',
      subtitle: 'Recent activity'
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Overview of your collections performance</p>
        </div>
      </div>

      {/* KPI Cards - Clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {cards.map((card) => (
          <div
            key={card.title}
            onClick={() => navigate(card.path)}
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = '#7C3AED';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: '0 0 4px 0' }}>{card.title}</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>{card.value}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>{card.subtitle}</p>
              </div>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                background: card.iconBg, 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <card.icon style={{ color: card.iconColor }} size={24} />
              </div>
            </div>
            <div style={{ 
              marginTop: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              fontSize: '14px', 
              color: '#7C3AED',
              opacity: 0.6,
              transition: 'opacity 0.2s ease'
            }}>
              Click to view details
              <ArrowRight size={14} style={{ marginLeft: '4px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity block — deferred. Requires attribution. See spec D3. */}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;