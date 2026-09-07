import React, { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Activity,
  UserCheck,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api.service';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalDebtors: number;
  totalDebt: number;
  totalAgents: number;
  totalActions: number;
  recentActivities: any[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDebtors: 0,
    totalDebt: 0,
    totalAgents: 0,
    totalActions: 0,
    recentActivities: []
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
      
      const token = localStorage.getItem('token') || localStorage.getItem('supervisor_token');
      
      if (!token) {
        setError('Please log in to view dashboard');
        setLoading(false);
        return;
      }

      const response = await api.get('/dashboard/stats');
      
      if (response && response.success && response.data) {
        setStats({
          totalDebtors: response.data.totalDebtors || 0,
          totalDebt: response.data.totalDebt || 0,
          totalAgents: response.data.totalAgents || 0,
          totalActions: response.data.totalActions || 0,
          recentActivities: response.data.recentActivities || []
        });
      }
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

  const cards = [
    {
      title: 'Total Debtors',
      value: stats.totalDebtors,
      icon: Users,
      iconBg: '#f3e8ff',
      iconColor: '#7C3AED',
      path: '/collections',
      subtitle: 'Active debtors'
    },
    {
      title: 'Total Debt',
      value: formatCurrency(stats.totalDebt),
      icon: DollarSign,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      path: '/collections',
      subtitle: 'Outstanding balance'
    },
    {
      title: 'Total Agents',
      value: stats.totalAgents,
      icon: UserCheck,
      iconBg: '#dbeafe',
      iconColor: '#2563eb',
      path: '/agents',
      subtitle: 'Active agents'
    },
    {
      title: 'Total Actions',
      value: stats.totalActions,
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

      {/* Recent Activity */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#9ca3af' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>Recent Activity</h2>
          </div>
          <button 
            onClick={() => navigate('/audit')}
            style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            View All →
          </button>
        </div>
        <div>
          {stats.recentActivities && stats.recentActivities.length > 0 ? (
            stats.recentActivities.slice(0, 5).map((activity: any, index: number) => (
              <div key={index} style={{ 
                padding: '12px 24px', 
                borderBottom: index < 4 ? '1px solid #f3f4f6' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>{activity.action || 'Activity'}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0 0' }}>
                    {activity.user || 'Unknown'} • {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {new Date(activity.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#6b7280' }}>
              <Activity size={32} style={{ margin: '0 auto 8px', color: '#d1d5db' }} />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;