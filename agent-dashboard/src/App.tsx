// GORKA Agent Dashboard - Stage D.3 entry flow + main shell.
//
// The entry flow is a state machine: loading -> login -> unlock
// -> enroll -> shell. It is not a router, because the three
// entry steps are sequential gates, not navigable destinations.
//
// Once the machine reaches the shell step, the shell is rendered
// inside a HashRouter. All further navigation (sidebar links,
// future debtor profile routes) lives inside that router.

import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import AppShell from '@/components/AppShell';
import StubPage from '@/components/StubPage';
import LoginPage from '@/pages/LoginPage';
import UnlockPage from '@/pages/UnlockPage';
import EnrollPage from '@/pages/EnrollPage';
import DebtorsPage from '@/pages/DebtorsPage';
import DebtorProfilePage from '@/pages/DebtorProfilePage';
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

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell onLogout={advance} />}>
          <Route
            path="/"
            element={
              <StubPage
                title="Today"
                subtitle="The plan view (calendar) arrives in D.5."
              />
            }
          />
          <Route path="/debtors" element={<DebtorsPage />} />
          <Route path="/debtors/:id" element={<DebtorProfilePage />} />
          <Route
            path="/communication-tools"
            element={
              <StubPage
                title="Communication Tools"
                subtitle="Your administrator has not enabled any communication tools yet."
              />
            }
          />
          <Route
            path="/actions"
            element={
              <StubPage
                title="Actions"
                subtitle="Cross-debtor actions arrive in D.6. For now, actions are reached from the debtor profile."
              />
            }
          />
          <Route
            path="/documents"
            element={
              <StubPage
                title="Documents"
                subtitle="Cross-debtor documents arrive in D.6. For now, documents are reached from the debtor profile."
              />
            }
          />
          <Route
            path="/copilot"
            element={
              <StubPage
                title="Copilot"
                subtitle="The AI Copilot arrives in a later phase."
              />
            }
          />
          <Route
            path="/settings"
            element={
              <StubPage
                title="Settings"
                subtitle="Local password change arrives in a later phase."
              />
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}