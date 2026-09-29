// GORKA Agent Dashboard - Stage D.2 entry flow.
//
// State machine: loading -> login -> unlock -> enroll -> shell.
// The bootstrap and each screen's success handler call advance(),
// which re-reads the current session state and moves the machine
// to wherever the user should be right now. This avoids manual
// step-to-step wiring and keeps the flow self-correcting.

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AppShell from '@/components/AppShell';
import LoginPage from '@/pages/LoginPage';
import UnlockPage from '@/pages/UnlockPage';
import EnrollPage from '@/pages/EnrollPage';
import { EntryCard, Spinner } from '@/components/primitives';

type EntryStep = 'loading' | 'login' | 'unlock' | 'enroll' | 'shell';

export default function App() {
  const [step, setStep] = useState<EntryStep>('loading');

  const advance = useCallback(async () => {
    try {
      await invoke<string>('get_auth_token');
    } catch {
      setStep('login');
      return;
    }

    try {
      const unlocked = await invoke<boolean>('is_database_unlocked');
      if (!unlocked) {
        setStep('unlock');
        return;
      }
    } catch {
      setStep('unlock');
      return;
    }

    try {
      const enrolled = await invoke<boolean>('is_enrolled');
      if (!enrolled) {
        setStep('enroll');
        return;
      }
    } catch {
      setStep('enroll');
      return;
    }

    setStep('shell');
  }, []);

  useEffect(() => {
    advance();
  }, [advance]);

  if (step === 'loading') {
    return (
      <EntryCard>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      </EntryCard>
    );
  }

  if (step === 'login') {
    return <LoginPage onSuccess={advance} />;
  }

  if (step === 'unlock') {
    return <UnlockPage onSuccess={advance} />;
  }

  if (step === 'enroll') {
    return <EnrollPage onSuccess={advance} />;
  }

  return <AppShell onLogout={advance} />;
}