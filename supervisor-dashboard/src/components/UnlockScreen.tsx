// src/components/UnlockScreen.tsx

import { useState, useEffect } from 'react';

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
        // If no salt exists, it's first time
        const salt = localStorage.getItem('salt');
        setIsFirstTime(!salt);
      } catch {
        setIsFirstTime(true);
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

      // Call the Rust unlock command
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('unlock_database', { password });
      
      // If first time, store salt indicator
      if (isFirstTime) {
        localStorage.setItem('salt', 'set');
      }
      
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔐</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            {isFirstTime ? 'Set Local Encryption Password' : 'Enter Local Encryption Password'}
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            {isFirstTime
              ? 'This password encrypts all debtor data on your machine.'
              : 'Enter your local encryption password to unlock debtor data.'}
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c00',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="Enter your local password"
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
        </div>

        {isFirstTime && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="Confirm your local password"
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              ⚠️ This password cannot be recovered. Store it safely.
            </p>
          </div>
        )}

        <button
          onClick={handleUnlock}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'Unlocking...' : isFirstTime ? 'Set Password' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}