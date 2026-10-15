// src/pages/SetupWizard.tsx
// Slice 8.2 first-run wizard. Triggered after first successful unlock
// when the setup_completed flag is absent from settings.dat.
// Step 1: enable_sync. Step 2: export_enrollment_package.
// Step 3: set_setup_completed(true).
// Failure at any step leaves no flag; retry is available on next launch.

import { useState } from 'react';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
} from '@/components/primitives';
import { save } from '@tauri-apps/plugin-dialog';
import { setup } from '@/services/local.db';
import './SetupWizard.css';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'sync' | 'export' | 'done';

const STEP_INDEX: Record<Step, number> = {
  welcome: 0,
  sync: 1,
  export: 2,
  done: 3,
};

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [filePath, setFilePath] = useState('');
  const [exportedPath, setExportedPath] = useState('');

  const stepIndex = STEP_INDEX[step];

  const handleEnableSync = async () => {
    setError('');
    setLoading(true);
    try {
      await setup.enableSync();
      setStep('export');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePath = async () => {
    setError('');
    try {
      const selected = await save({
        defaultPath: 'gorka-enrollment.gorka',
        filters: [
          { name: 'GORKA Enrollment Package', extensions: ['gorka'] },
        ],
      });
      if (typeof selected === 'string' && selected.length > 0) {
        setFilePath(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExport = async () => {
    setError('');
    if (!filePath) {
      setError('Choose a file path first');
      return;
    }
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }
    setLoading(true);
    try {
      const path = await setup.exportEnrollmentPackage(passphrase, filePath);
      setExportedPath(path);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setError('');
    setLoading(true);
    try {
      await setup.setSetupCompleted(true);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const subtitleForStep = (): string => {
    switch (step) {
      case 'welcome':
        return 'Welcome to GORKA';
      case 'sync':
        return 'Enable Sync';
      case 'export':
        return 'Export Enrollment Package';
      case 'done':
        return 'Setup Complete';
    }
  };

  return (
    <div className="setup-wizard-overlay">
      <EntryCard>
        <GorkaLogo subtitle={subtitleForStep()} />

        <div className="setup-wizard-steps">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={
                'setup-wizard-step-dot' +
                (i <= stepIndex - 1 ? ' active' : '')
              }
            />
          ))}
        </div>

        {error && <ErrorBanner message={error} />}

        {step === 'welcome' && (
          <>
            <p className="setup-wizard-hint">
              Let's get this device set up. Two short steps: enable
              encrypted sync for your organization, then export an
              enrollment package for each Agent device.
            </p>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => setStep('sync')}
            >
              Get Started
            </Button>
          </>
        )}

        {step === 'sync' && (
          <>
            <p className="setup-wizard-hint">
              This generates the encryption key that protects data
              traveling between your devices. The key never leaves
              this organization.
            </p>
            <div className="setup-wizard-actions">
              <Button
                type="button"
                variant="primary"
                loading={loading}
                onClick={handleEnableSync}
              >
                {loading ? 'Enabling...' : 'Enable Sync'}
              </Button>
            </div>
          </>
        )}

        {step === 'export' && (
          <>
            <p className="setup-wizard-hint">
              Choose where to save the enrollment package and set a
              passphrase. You will need both to enroll each Agent
              device.
            </p>

            <div className="form-field">
              <Label htmlFor="wizard-path">Package file</Label>
              <Input
                id="wizard-path"
                type="text"
                value={filePath}
                readOnly
                placeholder="Click Choose File"
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <Button
                type="button"
                variant="ghost"
                fullWidth
                disabled={loading}
                onClick={handleChoosePath}
              >
                Choose File
              </Button>
            </div>

            <div className="form-field">
              <Label htmlFor="wizard-pass">Passphrase</Label>
              <Input
                id="wizard-pass"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <Label htmlFor="wizard-pass-confirm">Confirm Passphrase</Label>
              <Input
                id="wizard-pass-confirm"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="setup-wizard-actions">
              <Button
                type="button"
                variant="primary"
                loading={loading}
                onClick={handleExport}
              >
                {loading ? 'Exporting...' : 'Export Package'}
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <p className="setup-wizard-hint">
              Your enrollment package is ready. Store it safely and
              deliver it to each Agent device along with the
              passphrase.
            </p>
            {exportedPath && (
              <div className="setup-wizard-success">{exportedPath}</div>
            )}
            <div className="setup-wizard-actions">
              <Button
                type="button"
                variant="primary"
                loading={loading}
                onClick={handleFinish}
              >
                {loading ? 'Finishing...' : 'Finish Setup'}
              </Button>
            </div>
          </>
        )}
      </EntryCard>
    </div>
  );
}