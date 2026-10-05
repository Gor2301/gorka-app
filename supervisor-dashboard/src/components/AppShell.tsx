import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { auth } from '../services/local.db';
import SyncIndicator from './SyncIndicator';

interface AppShellProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ children, onLogout }) => {
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const name = await auth.getUserName();
        if (cancelled) return;
        if (name && name.trim()) {
          setDisplayName(name);
          return;
        }
        const email = await auth.getUserEmail();
        if (cancelled) return;
        setDisplayName(email ?? '');
      } catch {
        // no-op; displayName stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
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
            <SyncIndicator />
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              {displayName}
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
              {displayName
                ? displayName
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : '?'}
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