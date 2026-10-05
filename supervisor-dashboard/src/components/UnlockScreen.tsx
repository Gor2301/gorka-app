// src/components/UnlockScreen.tsx

import { useState, useEffect } from 'react';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
} from '@/components/primitives';
import './UnlockScreen.css';

interface UnlockScreenProps {
  onUnlocked: () => void;
}

export default function UnlockScreen({ onUnlocked }: UnlockScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const exists = await invoke<boolean>('database_exists');
        setIsFirstTime(!exists);
      } catch (err) {
        // If we cannot determine whether the database exists, we must NOT
        // fall back to "set password": doing so could overwrite an existing
        // database with a new password. Show an error state instead.
        setError(
          err instanceof Error
            ? `Could not determine local database state: ${err.message}`
            : 'Could not determine local database state',
        );
      }
    };
    checkFirstTime();
  }, []);

  const handleUnlock = async () => {
    setError('');
    setLoading(true);

    try {
      if (isFirstTime && password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (isFirstTime && password.length < 8) {
        setError('Password must be at least 8 characters');
        setLoading(false);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('unlock_database', { password });

      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock database');
    } finally {
      setLoading(false);
    }
  };

  const subtitle = isFirstTime
    ? 'Set Local Encryption Password'
    : 'Enter Local Encryption Password';

  return (
    <EntryCard>
      <GorkaLogo subtitle={subtitle} />

      <p className="unlock-hint">
        {isFirstTime
          ? 'This password encrypts all debtor data on your machine.'
          : 'Enter your local encryption password to unlock debtor data.'}
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="form-field">
        <Label htmlFor="unlock-password">Password</Label>
        <Input
          id="unlock-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your local password"
          autoFocus
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
        />
      </div>

      {isFirstTime && (
        <div className="form-field">
          <Label htmlFor="unlock-confirm">Confirm Password</Label>
          <Input
            id="unlock-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your local password"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <p className="unlock-warning">
            This password cannot be recovered. Store it safely.
          </p>
        </div>
      )}

      <div className="form-field--last">
        <Button
          type="button"
          variant="primary"
          fullWidth
          loading={loading}
          onClick={handleUnlock}
        >
          {loading ? 'Unlocking...' : isFirstTime ? 'Set Password' : 'Unlock'}
        </Button>
      </div>
    </EntryCard>
  );
}