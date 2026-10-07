import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { auth } from '../services/local.db';
import SyncIndicator from './SyncIndicator';

interface AppShellProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/agents': 'Agents',
  '/collections': 'Collections',
  '/upload': 'Data Upload',
  '/audit': 'Audit Logs',
  '/permissions': 'Permissions',
  '/analytics': 'Analytics',
  '/billing': 'Billing',
  '/settings': 'Settings',
  '/compliance': 'Compliance Report',
  '/data-flow-audit': 'Data Flow Audit',
  '/calendar': 'Calendar',
  '/connectors': 'Connectors',
  '/support': 'Support',
  '/status': 'GORKA Status',
  '/my-requests': 'My Requests',
};

function deriveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && PAGE_TITLES['/' + seg]) return PAGE_TITLES['/' + seg];
  return 'Dashboard';
}

const AppShell: React.FC<AppShellProps> = ({ children, onLogout }) => {
  const [displayName, setDisplayName] = useState<string>('');
  const location = useLocation();
  const title = deriveTitle(location.pathname);

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
        // no-op
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
            {title}
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