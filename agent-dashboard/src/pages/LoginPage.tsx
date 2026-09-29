import { useState } from 'react';
import type { FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
} from '@/components/primitives';
import './LoginPage.css';

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await invoke<string>('login', { email, password });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Login failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntryCard>
      <GorkaLogo subtitle="Agent App" />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="form-field--last">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your account password"
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </EntryCard>
  );
}