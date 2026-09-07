import React from 'react';
import OwnerSidebar from './OwnerSidebar';

interface OwnerAppShellProps {
  children: React.ReactNode;
}

const OwnerAppShell: React.FC<OwnerAppShellProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <OwnerSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* CONTENT HEADER */}
        <header style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E3E3E3',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          height: '73px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#111111' }}>
            Owner Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#4A4A4A' }}>Platform Owner</span>
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
              O
            </div>
          </div>
        </header>
        {/* CONTENT */}
        <main style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          backgroundColor: '#FFFFFF'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default OwnerAppShell;