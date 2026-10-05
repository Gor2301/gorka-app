// agent-dashboard/src/components/SyncIndicator.tsx
//
// Polls sync_engine_status every 2 seconds and displays a small
// user-facing indicator in the top header. Never shows the raw
// error string; the header presents a concise human-readable
// state. Detailed diagnostics belong elsewhere.

import { useEffect, useState } from 'react';
import { localDB } from '../services/local.db';

type Display = {
  label: string;
  cls: string;
};

function mapStatus(raw: string): Display {
  if (raw === 'synced') return { label: 'Synced', cls: 'sync--synced' };
  if (raw === 'pending') return { label: 'Syncing', cls: 'sync--pending' };
  if (raw === 'connecting') return { label: 'Connecting', cls: 'sync--connecting' };
  if (raw === 'offline') return { label: 'Offline', cls: 'sync--offline' };
  if (raw === 'disabled') return { label: 'Sync off', cls: 'sync--disabled' };
  if (raw.startsWith('error')) return { label: 'Sync problem', cls: 'sync--error' };
  return { label: 'Sync off', cls: 'sync--disabled' };
}

export default function SyncIndicator() {
  const [display, setDisplay] = useState<Display>(() =>
    mapStatus('disabled'),
  );

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
    <div className={`sync ${display.cls}`} title={display.label}>
      <span className="sync__dot" />
      <span className="sync__label">{display.label}</span>
    </div>
  );
}