import { useState } from 'react';
import { X } from 'lucide-react';

interface ResendByopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, any>, credentials: Record<string, any>) => void;
  connectorName: string;
  provider: string;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  backgroundColor: 'rgba(0,0,0,0.5)',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  maxWidth: '440px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  backgroundColor: 'white',
  borderBottom: '1px solid #e5e7eb',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: '12px 12px 0 0',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#111827',
  margin: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  color: '#6b7280',
  display: 'flex',
  alignItems: 'center',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px',
};

const introTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 16px 0',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 8px 0',
};

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '4px',
};

const requiredStarStyle: React.CSSProperties = {
  color: '#dc2626',
  marginLeft: '2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '4px 0 0 0',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '16px 20px',
  borderTop: '1px solid #e5e7eb',
  justifyContent: 'flex-end',
};

const btnGhostStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  backgroundColor: 'white',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  cursor: 'pointer',
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  backgroundColor: '#7C3AED',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

export function ResendByopModal({
  isOpen,
  onClose,
  onSave,
  connectorName,
  provider,
}: ResendByopModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [from, setFrom] = useState('onboarding@resend.dev');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ from }, { apiKey });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Configure {connectorName}</h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={bodyStyle}>
            <p style={introTextStyle}>
              Enter your Resend API key and the address you send from.
            </p>

            <p style={sectionLabelStyle}>Credentials</p>

            <div style={fieldWrapStyle}>
              <label style={labelStyle}>
                API Key
                <span style={requiredStarStyle}>*</span>
              </label>
              <input
                type="password"
                style={inputStyle}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="re_..."
                required
              />
            </div>

            <div style={fieldWrapStyle}>
              <label style={labelStyle}>
                From address
                <span style={requiredStarStyle}>*</span>
              </label>
              <input
                type="email"
                style={inputStyle}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="onboarding@resend.dev"
                required
              />
              <p style={helpTextStyle}>
                Must be a domain verified in {provider}.
              </p>
            </div>
          </div>

          <div style={footerStyle}>
            <button type="button" style={btnGhostStyle} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={btnPrimaryStyle} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}