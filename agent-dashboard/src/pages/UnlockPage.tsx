import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
  Spinner,
} from '@/components/primitives';
import './UnlockPage.css';

interface UnlockPageProps {
  onSuccess: () => void;
}

type Mode = 'loading' | 'set' | 'enter';

export default function UnlockPage({ onSuccess }: UnlockPageProps) {
  const [mode, setMode] = useState<Mode>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const exists = await invoke<boolean>('database_exists');
        if (!cancelled) {
          setMode(exists ? 'enter' : 'set');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Could not determine local database state',
          );
          setMode('enter');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'set') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    setLoading(true);
    try {
      await invoke('unlock_database', { password });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Failed to unlock database',
      );
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <EntryCard>
        <div className="unlock-page__loading">
          <Spinner />
        </div>
      </EntryCard>
    );
  }

  const isSet = mode === 'set';

  return (
    <EntryCard>
      <GorkaLogo
        subtitle={
          isSet ? 'Set Local Encryption Password' : 'Enter Local Encryption Password'
        }
      />

      <p className="unlock-page__hint">
        {isSet
          ? 'This password encrypts all debtor data on this machine. Store it safely.'
          : 'Enter your local encryption password to unlock debtor data.'}
      </p>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <Label htmlFor="unlock-password">Password</Label>
          <Input
            id="unlock-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSet ? 'Choose a password' : 'Your local password'}
            required
            autoFocus
            disabled={loading}
          />
        </div>

        {isSet && (
          <div className="form-field">
            <Label htmlFor="unlock-confirm">Confirm Password</Label>
            <Input
              id="unlock-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
            <p className="unlock-page__warning">
              This password cannot be recovered. Store it safely.
            </p>
          </div>
        )}

        <div className="form-field--last">
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {loading ? 'Unlocking...' : isSet ? 'Set Password' : 'Unlock'}
          </Button>
        </div>
      </form>
    </EntryCard>
  );
}