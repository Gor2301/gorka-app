import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Activity,
  Settings,
  LogOut,
  Ticket,
  Inbox
} from 'lucide-react';

const OwnerSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Clients', path: '/clients' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: CreditCard, label: 'Billing', path: '/billing' },
    { icon: Activity, label: 'Audit Logs', path: '/audit' },
    { icon: Ticket, label: 'Support', path: '/support' },
{ icon: Inbox, label: 'Inbox', path: '/inbox' },
    { icon: Settings, label: 'Settings', path: '/settings' },

  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#FAFAFA',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      borderRight: '1px solid #E3E3E3'
    }}>
      {/* PART 1: SIDEBAR HEADER */}
      <div style={{
        height: '73px',
        padding: '0 16px',
        borderBottom: '2px solid #E3E3E3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: '#FAFAFA'
      }}>
        <div style={{
          fontSize: '26px',
          fontWeight: 'bold',
          color: '#F01428'
        }}>
          GORKA
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: '500',
          color: '#7C3AED',
          marginLeft: '6px',
          marginTop: '10px'
        }}>
          OWNER
        </span>
      </div>

      {/* PART 2: REST OF SIDEBAR */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 12px',
        overflowY: 'auto',
        backgroundColor: '#FAFAFA'
      }}>
        <nav style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  height: '36px',
                  background: isActive ? '#F4F0FF' : 'transparent',
                  color: isActive ? '#7C3AED' : '#4A4A4A',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: isActive ? '500' : '400',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#F4F0FF';
                    e.currentTarget.style.color = '#7C3AED';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#4A4A4A';
                  }
                }}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout at bottom */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            height: '36px',
            background: 'transparent',
            color: '#4A4A4A',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            borderTop: '1px solid #E3E3E3',
            paddingTop: '12px',
            marginTop: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F4F0FF';
            e.currentTarget.style.color = '#7C3AED';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#4A4A4A';
          }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default OwnerSidebar;