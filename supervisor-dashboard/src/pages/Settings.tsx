// src/pages/Settings.tsx
// Slice 8.2. Re-entry point for the two operations the first-run
// wizard performs: enable_sync and export_enrollment_package.
// The page-level header style matches the previous stub.

import { useState } from 'react';
import {
  Button,
  ErrorBanner,
  Input,
  Label,
} from '@/components/primitives';
import { save } from '@tauri-apps/plugin-dialog';
import { setup } from '@/services/local.db';
import './Settings.css';

export default function Settings() {
  const [syncError, setSyncError] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState('');

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [filePath, setFilePath] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  const handleEnableSync = async () => {
    setSyncError('');
    setSyncSuccess('');
    setSyncLoading(true);
    try {
      await setup.enableSync();
      setSyncSuccess('Sync enabled.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncLoading(false);
    }
  };

  const handleChoosePath = async () => {
    setExportError('');
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
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExport = async () => {
    setExportError('');
    setExportSuccess('');
    if (!filePath) {
      setExportError('Choose a file path first');
      return;
    }
    if (passphrase.length < 8) {
      setExportError('Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setExportError('Passphrases do not match');
      return;
    }
    setExportLoading(true);
    try {
      const path = await setup.exportEnrollmentPackage(passphrase, filePath);
      setExportSuccess('Exported to ' + path);
      setPassphrase('');
      setConfirmPassphrase('');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <div className="settings-card">
        <h2 className="settings-card-title">Sync &amp; Enrollment</h2>
        <p className="settings-card-description">
          Enable encrypted sync for this organization. This generates
          the key that protects data traveling between your devices.
        </p>

        {syncError && <ErrorBanner message={syncError} />}
        {syncSuccess && (
          <div className="settings-success">{syncSuccess}</div>
        )}
        <div className="settings-actions">
          <Button
            type="button"
            variant="primary"
            loading={syncLoading}
            onClick={handleEnableSync}
          >
            {syncLoading ? 'Enabling...' : 'Enable Sync'}
          </Button>
        </div>
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">Export Enrollment Package</h2>
        <p className="settings-card-description">
          Generate an enrollment package for an Agent device. The
          passphrase will be required when the Agent imports the
          package.
        </p>

        {exportError && <ErrorBanner message={exportError} />}
        {exportSuccess && (
          <div className="settings-success">{exportSuccess}</div>
        )}

        <div className="form-field">
          <Label htmlFor="settings-export-path">Package file</Label>
          <Input
            id="settings-export-path"
            type="text"
            value={filePath}
            readOnly
            placeholder="Click Choose File"
            disabled={exportLoading}
          />
        </div>
        <div className="form-field">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={exportLoading}
            onClick={handleChoosePath}
          >
            Choose File
          </Button>
        </div>

        <div className="form-field">
          <Label htmlFor="settings-export-pass">Passphrase</Label>
          <Input
            id="settings-export-pass"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="At least 8 characters"
            disabled={exportLoading}
          />
        </div>
        <div className="form-field">
          <Label htmlFor="settings-export-pass-confirm">
            Confirm Passphrase
          </Label>
          <Input
            id="settings-export-pass-confirm"
            type="password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            disabled={exportLoading}
          />
        </div>

        <div className="settings-actions">
          <Button
            type="button"
            variant="primary"
            loading={exportLoading}
            onClick={handleExport}
          >
            {exportLoading ? 'Exporting...' : 'Export Package'}
          </Button>
        </div>
      </div>
    </div>
  );
}