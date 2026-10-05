// supervisor-dashboard/src/components/SyncIndicator.tsx
//
// Polls sync_engine_status every 2 seconds and displays a small
// user-facing indicator in the top header. Never shows the raw
// error string; the header presents a concise human-readable
// state. Detailed diagnostics belong elsewhere.
//
// Inline styles, matching this app's TopHeader convention.

import React, { useEffect, useState } from 'react';
import { localDB } from '../services/local.db';

type Display = {
  label: string;
  dot: string;
  labelColor: string;
};

function mapStatus(raw: string): Display {
  if (raw === 'synced') {
    return { label: 'Synced', dot: '#16a34a', labelColor: '#374151' };
  }
  if (raw === 'pending') {
    return { label: 'Syncing', dot: '#ea580c', labelColor: '#ea580c' };
  }
  if (raw === 'connecting') {
    return { label: 'Connecting', dot: '#9ca3af', labelColor: '#6b7280' };
  }
  if (raw === 'offline') {
    return { label: 'Offline', dot: '#9ca3af', labelColor: '#6b7280' };
  }
  if (raw === 'disabled') {
    return { label: 'Sync off', dot: '#9ca3af', labelColor: '#6b7280' };
  }
  if (raw.startsWith('error')) {
    return { label: 'Sync problem', dot: '#dc2626', labelColor: '#dc2626' };
  }
  return { label: 'Sync off', dot: '#9ca3af', labelColor: '#6b7280' };
}

const SyncIndicator: React.FC = () => {
  const [display, setDisplay] = useState<Display>(() => mapStatus('disabled'));

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const raw = await localDB.syncEngineStatus();
        if (!cancelled) setDisplay(mapStatus(raw));
      } catch {
        if (!cancelled) setDisplay(mapStatus('disabled'));
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div
      title={display.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: display.labelColor,
        cursor: 'default',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: display.dot,
        }}
      />
      <span>{display.label}</span>
    </div>
  );
};

export default SyncIndicator;