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
import PlanPage from '@/pages/PlanPage';
import ActionsPage from '@/pages/ActionsPage';
import CommunicationToolsPage from '@/pages/CommunicationToolsPage';
import SettingsPage from '@/pages/SettingsPage';
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

  const handleLogout = useCallback(async () => {
    try {
      await invoke('logout');
    } catch {
      // Logout failure must not block the UI transition.
    }
    setStep('login');
  }, []);

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
        <Route element={<AppShell onLogout={handleLogout} />}>
          <Route
            path="/"
            element={
              <StubPage
                title="Today"
                subtitle="The plan view (calendar) arrives in D.5."
              />
            }
          />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/debtors" element={<DebtorsPage />} />
          <Route path="/debtors/:id" element={<DebtorProfilePage />} />
          <Route
            path="/communication-tools"
            element={<CommunicationToolsPage />}
          />
          <Route path="/actions" element={<ActionsPage />} />
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
            path="/support"
            element={
              <StubPage
                title="Support"
                subtitle="The support system arrives in a later phase."
              />
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}