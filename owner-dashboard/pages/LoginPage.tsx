import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://api.gorka.localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

console.log('🔍 FULL LOGIN RESPONSE:', JSON.stringify(data, null, 2));
console.log('🔍 TOKEN FROM RESPONSE:', data.data?.token);
console.log('🔍 TOKEN LENGTH:', data.data?.token?.length);


      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

// ✅ Store token
if (data.success && data.data.token) {
  localStorage.setItem('gorka_token', data.data.token);
  console.log('✅ TOKEN STORED!');
  console.log('✅ STORED TOKEN LENGTH:', localStorage.getItem('gorka_token')?.length);
} else {
  console.error('❌ No token in response!');
}

     // Save token and user data
     // localStorage.setItem('token', data.data.token);
     // localStorage.setItem('user', JSON.stringify(data.data.user));

      // Redirect to dashboard
      window.location.href = data.data.redirectUrl || '/';
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#FAFAFA'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#F01428'
          }}>
            GORKA
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6B7280',
            marginTop: '4px'
          }}>
            Owner Dashboard
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              backgroundColor: '#FEE2E2',
              color: '#EF4444',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#111111',
              marginBottom: '4px'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
              placeholder="admin@gorka.click"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#111111',
              marginBottom: '4px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #E3E3E3',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

<p style={{ 
  textAlign: 'center', 
  marginTop: '16px', 
  fontSize: '14px', 
  color: '#6B7280' 
}}>
  Don't have an account?{' '}
  <Link 
    to="/register" 
    style={{ 
      color: '#7C3AED', 
      textDecoration: 'none', 
      fontWeight: '500' 
    }}
  >
    Create Account
  </Link>
</p>


        </form>
      </div>
    </div>
  );
};

export default LoginPage;