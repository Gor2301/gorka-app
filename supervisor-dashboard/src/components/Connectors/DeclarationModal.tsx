import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

type DeclarationTier = 'TIER1' | 'TIER2';

interface DeclarationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  connectorName: string;
  tier: DeclarationTier;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  backgroundColor: 'rgba(0,0,0,0.4)',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  width: '440px',
  maxWidth: '90vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #e5e7eb',
};

const headerLeftStyle = (tier: DeclarationTier): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: tier === 'TIER1' ? '#2563eb' : '#dc2626',
});

const headerTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  margin: 0,
};

const closeBtnStyle: React.CSSProperties = {
  padding: '4px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const introStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#374151',
  margin: 0,
};

const introNameStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
};

const listStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  paddingLeft: '18px',
};

const boxTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  margin: 0,
};

const warningStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  lineHeight: 1.5,
};

const infoStyle: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e40af',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  lineHeight: 1.5,
};

const commitStyle: React.CSSProperties = {
  backgroundColor: '#f4f0ff',
  border: '1px solid #ddd6fe',
  color: '#4c1d95',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  lineHeight: 1.5,
};

const commitTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 600,
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '16px 20px',
  borderTop: '1px solid #e5e7eb',
  justifyContent: 'flex-end',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '8px',
  backgroundColor: 'white',
  color: '#374151',
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
};

const acceptBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '8px',
  backgroundColor: '#7C3AED',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
};

export function DeclarationModal({
  isOpen,
  onClose,
  onAccept,
  connectorName,
  tier,
}: DeclarationModalProps) {
  if (!isOpen) return null;

  const isTier1 = tier === 'TIER1';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={headerLeftStyle(tier)}>
            {isTier1 ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
            <h2 style={headerTitleStyle}>Third-party connection</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            <X size={18} color="#6b7280" />
          </button>
        </div>

        <div style={bodyStyle}>
          <p style={introStyle}>
            You are about to connect GORKA to <span style={introNameStyle}>{connectorName}</span>.
          </p>

          {isTier1 ? (
            <div style={infoStyle}>
              <p style={boxTitleStyle}>How this works</p>
              <ul style={listStyle}>
                <li>GORKA provides and manages the credentials for {connectorName}.</li>
                <li>The credential is delivered securely to your device.</li>
                <li>Messages are sent directly from your device to {connectorName}.</li>
              </ul>
            </div>
          ) : (
            <div style={warningStyle}>
              <p style={boxTitleStyle}>You are responsible for this third party.</p>
              <ul style={listStyle}>
                <li>{connectorName} is outside GORKA's control.</li>
                <li>GORKA does not guarantee their security, compliance, or data handling.</li>
                <li>You are responsible for any data transmitted to them.</li>
                <li>You have reviewed their terms.</li>
                <li>You may disconnect at any time.</li>
              </ul>
            </div>
          )}

          <div style={commitStyle}>
            <p style={commitTitleStyle}>
              <ShieldCheck size={16} />
              GORKA's commitment
            </p>
            <ul style={listStyle}>
              {isTier1 ? (
                <>
                  <li>Your debtor data never reaches GORKA's cloud.</li>
                  <li>Messages go directly from your device to {connectorName}.</li>
                  <li>You may disconnect at any time.</li>
                </>
              ) : (
                <>
                  <li>Your credential is stored locally on this device, encrypted at rest.</li>
                  <li>The credential never reaches GORKA's cloud.</li>
                  <li>GORKA cannot read your debtor data.</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          <button onClick={onAccept} style={acceptBtnStyle}>
            I understand & connect
          </button>
        </div>
      </div>
    </div>
  );
}