import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CredentialField, CredentialSchema } from '../../services/connectors.service';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, any>, credentials: Record<string, any>) => void;
  connectorName: string;
  provider: string;
  credentialSchema: CredentialSchema | null;
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0,
  zIndex: 50, display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: '16px',
  backgroundColor: 'rgba(0,0,0,0.5)' };

const modalStyle: React.CSSProperties = { backgroundColor: 'white',
  borderRadius: '12px', maxWidth: '440px', width: '100%',
  maxHeight: '90vh', overflowY: 'auto' };

const headerStyle: React.CSSProperties = { position: 'sticky', top: 0,
  backgroundColor: 'white', borderBottom: '1px solid #e5e7eb',
  padding: '16px 20px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', borderRadius: '12px 12px 0 0' };

const titleStyle: React.CSSProperties = { fontSize: '16px',
  fontWeight: 600, color: '#111827', margin: 0 };

const closeBtnStyle: React.CSSProperties = { background: 'none',
  border: 'none', cursor: 'pointer', padding: '4px',
  color: '#6b7280', display: 'flex', alignItems: 'center' };

const bodyStyle: React.CSSProperties = { padding: '20px' };

const introTextStyle: React.CSSProperties = { fontSize: '13px',
  color: '#6b7280', margin: '0 0 16px 0' };

const sectionLabelStyle: React.CSSProperties = { fontSize: '13px',
  fontWeight: 600, color: '#374151', margin: '0 0 8px 0' };

const fieldWrapStyle: React.CSSProperties = { marginBottom: '12px' };

const labelStyle: React.CSSProperties = { display: 'block',
  fontSize: '13px', fontWeight: 500, color: '#374151',
  marginBottom: '4px' };

const requiredStarStyle: React.CSSProperties = { color: '#dc2626',
  marginLeft: '2px' };

const inputStyle: React.CSSProperties = { width: '100%',
  padding: '8px 12px', fontSize: '14px',
  border: '1px solid #e5e7eb', borderRadius: '8px',
  outline: 'none', boxSizing: 'border-box' };

const footerStyle: React.CSSProperties = { display: 'flex',
  gap: '8px', padding: '16px 20px',
  borderTop: '1px solid #e5e7eb', justifyContent: 'flex-end' };

const btnGhostStyle: React.CSSProperties = { padding: '8px 16px',
  fontSize: '14px', fontWeight: 500, backgroundColor: 'white',
  color: '#374151', border: '1px solid #e5e7eb',
  borderRadius: '8px', cursor: 'pointer' };

const btnPrimaryStyle: React.CSSProperties = { padding: '8px 16px',
  fontSize: '14px', fontWeight: 500, backgroundColor: '#7C3AED',
  color: 'white', border: 'none', borderRadius: '8px',
  cursor: 'pointer' };

const emptySchemaStyle: React.CSSProperties = { fontSize: '13px',
  color: '#6b7280', margin: '8px 0 0 0' };

function initFromFields(fields: CredentialField[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    out[f.name] = f.default ?? '';
  }
  return out;
}

export function ConfigurationModal({
  isOpen, onClose, onSave, connectorName, provider, credentialSchema,
}: ConfigurationModalProps) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfig({});
      setCredentials({});
      return;
    }
    setConfig(initFromFields(credentialSchema?.configuration ?? []));
    setCredentials(initFromFields(credentialSchema?.credentials ?? []));
  }, [isOpen, credentialSchema]);

  if (!isOpen) return null;

  const hasSchema = !!credentialSchema
    && (credentialSchema.credentials.length > 0
        || credentialSchema.configuration.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSchema) return;
    setLoading(true);
    try {
      await onSave(config, credentials);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (
    field: CredentialField,
    values: Record<string, any>,
    setValues: (v: Record<string, any>) => void,
  ) => (
    <div key={field.name} style={fieldWrapStyle}>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={requiredStarStyle}>*</span>}
      </label>
      <input
        type={field.type}
        style={inputStyle}
        value={values[field.name] ?? ''}
        onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
        placeholder={field.placeholder}
        required={field.required}
      />
    </div>
  );

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
            {!hasSchema ? (
              <p style={emptySchemaStyle}>
                No configuration available for {connectorName}.
              </p>
            ) : (
              <>
                <p style={introTextStyle}>Enter your credentials for {provider}.</p>

                {credentialSchema!.credentials.length > 0 && (
                  <>
                    <p style={sectionLabelStyle}>Credentials</p>
                    {credentialSchema!.credentials.map((f) =>
                      renderField(f, credentials, setCredentials),
                    )}
                  </>
                )}

                {credentialSchema!.configuration.length > 0 && (
                  <>
                    <p style={sectionLabelStyle}>Configuration</p>
                    {credentialSchema!.configuration.map((f) =>
                      renderField(f, config, setConfig),
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <div style={footerStyle}>
            <button type="button" style={btnGhostStyle} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              style={btnPrimaryStyle}
              disabled={loading || !hasSchema}
            >
              {loading ? 'Saving...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}