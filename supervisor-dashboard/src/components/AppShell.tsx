import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { apiService } from '../services/api.service';

interface AppShellProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ children, onLogout }) => {
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    apiService.get('/auth/me')
      .then((data) => {
        if (data.success) {
          setUser(data.data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={onLogout} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* CONTENT HEADER */}
        <header style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          height: '73px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
            Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              {user?.name || 'Supervisor'}
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {user?.name
                ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                : 'S'}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          backgroundColor: '#f9fafb'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;