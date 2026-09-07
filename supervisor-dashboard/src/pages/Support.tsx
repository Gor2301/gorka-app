import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, Send } from 'lucide-react';

const Support: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // ─── DISABLED: Old localStorage auth check ────────────────────────────
      // const token = localStorage.getItem('token');
      // const user = JSON.parse(localStorage.getItem('user') || '{}');
      // 
      // console.log('Token:', token);
      // console.log('User:', user);
      // ──────────────────────────────────────────────────────────────────────

      const requestBody = {
        organizationId: 'org1',
        subject,
        message,
        category,
        openedByEmail: 'agency@owner.com',
        isPersonal: true
      };
      
      console.log('Request body:', requestBody);

const token = localStorage.getItem('gorka_token');
const response = await fetch('http://api.gorka.localhost:3000/api/support/tickets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestBody)
});

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create support request');
      }

      setSuccess(true);
      setSubject('');
      setMessage('');
      setCategory('OTHER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create support request');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#22C55E', marginBottom: '16px' }}>✅ Request Sent!</h2>
          <p style={{ color: '#4A4A4A', marginBottom: '16px' }}>
            Your support request has been sent. Our support team will review it and get back to you shortly.
          </p>
          <button
            onClick={() => navigate('/support')}
            style={{
              padding: '8px 24px',
              backgroundColor: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Send Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <LifeBuoy size={28} color="#7C3AED" />
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', margin: 0 }}>
          Support
        </h2>
        <span style={{
          fontSize: '12px',
          backgroundColor: '#F3F4F6',
          padding: '2px 12px',
          borderRadius: '12px',
          color: '#6B7280'
        }}>
          Contact GORKA Owner
        </span>
      </div>

      <p style={{ color: '#4A4A4A', marginBottom: '24px' }}>
        Need help with something? Send a message directly to the GORKA Platform Owner.
        We'll get back to you as soon as possible.
      </p>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEE2E2',
          color: '#DC2626',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white',
        border: '1px solid #E3E3E3',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Brief summary of your issue"
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none'
            }}
          >
            <option value="BILLING">Billing</option>
            <option value="TECHNICAL">Technical</option>
            <option value="ACCOUNT_ACCESS">Account Access</option>
            <option value="FEATURE_REQUEST">Feature Request</option>
            <option value="BUG">Bug Report</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>
            Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder="Describe your issue in detail..."
            rows={6}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            backgroundColor: '#7C3AED',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          <Send size={16} />
          {loading ? 'Sending...' : 'Send to GORKA Owner'}
        </button>
      </form>
    </div>
  );
};

export default Support;