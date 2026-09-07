import React from 'react';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      
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
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Supervisor</span>
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
              S
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