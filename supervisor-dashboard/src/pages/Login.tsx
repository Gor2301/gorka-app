import { useState } from 'react';
import type { FormEvent } from 'react';
import { auth } from '../services/local.db';
import {
  Button,
  EntryCard,
  ErrorBanner,
  GorkaLogo,
  Input,
  Label,
} from '@/components/primitives';
import './Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await auth.login(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Invalid email or password',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntryCard>
      <GorkaLogo subtitle="Client Dashboard" />

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