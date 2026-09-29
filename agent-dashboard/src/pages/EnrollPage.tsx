import { useState } from 'react';
import type { FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
} from '@/components/primitives';
import './EnrollPage.css';

interface EnrollPageProps {
  onSuccess: () => void;
}

export default function EnrollPage({ onSuccess }: EnrollPageProps) {
  const [filePath, setFilePath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    setError('');
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: 'GORKA enrollment package', extensions: ['gorka'] },
        ],
      });
      if (typeof selected === 'string') {
        setFilePath(selected);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Could not open file picker',
      );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!filePath) {
      setError('Select an enrollment package file first');
      return;
    }
    if (!passphrase) {
      setError('Enter the passphrase for the package');
      return;
    }

    setLoading(true);
    try {
      await invoke('import_enrollment_package', { passphrase, filePath });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Could not import enrollment package',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntryCard>
      <GorkaLogo subtitle="Enroll This Device" />

      <p className="enroll-page__hint">
        Select the enrollment package your administrator exported, and
        enter its passphrase.
      </p>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <Label>Package file</Label>
          <div className="enroll-page__file-row">
            <Input
              type="text"
              value={filePath}
              readOnly
              placeholder="No file selected"
              disabled={loading}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={pickFile}
              disabled={loading}
            >
              Select
            </Button>
          </div>
        </div>

        <div className="form-field--last">
          <Label htmlFor="enroll-passphrase">Passphrase</Label>
          <Input
            id="enroll-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Package passphrase"
            disabled={loading}
          />
        </div>

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {loading ? 'Importing...' : 'Import Package'}
        </Button>
      </form>
    </EntryCard>
  );
}