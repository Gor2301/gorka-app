import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, any>, credentials: Record<string, any>) => void;
  connectorName: string;
  provider: string;
}

export function ConfigurationModal({ 
  isOpen, 
  onClose, 
  onSave, 
  connectorName, 
  provider 
}: ConfigurationModalProps) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [authType, setAuthType] = useState<string>('API Key');

  // ─── Get default credentials from .env ──────────────────────────────
  const getDefaultCredentials = (provider: string): Record<string, any> => {
    switch (provider) {
      case 'resend':
        return {
          apiKey: import.meta.env.VITE_RESEND_API_KEY || '',
        };
      case 'mocean':
        return {
          apiKey: import.meta.env.VITE_MOCEAN_API_KEY || '',
          apiSecret: import.meta.env.VITE_MOCEAN_API_SECRET || '',
        };
      case 'twilio_voice':
        return {
          authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || '',
        };
      case 'twilio_sms':
        return {
          authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || '',
        };
      case 'sendgrid':
        return {
          apiKey: import.meta.env.VITE_SENDGRID_API_KEY || '',
        };
      case 'external_api':
        return {};
      default:
        return {};
    }
  };

  // ─── Initialize credentials with defaults ───────────────────────────
  const [credentials, setCredentials] = useState<Record<string, any>>(
    getDefaultCredentials(provider)
  );

  if (!isOpen) return null;

  const getConfigFields = () => {
    const fields: Record<string, any> = {
      resend: [
        { name: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://api.resend.com', required: true }
      ],
      mocean: [
        { name: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://rest.moceanapi.com', required: true }
      ],
      twilio_voice: [
        { name: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://api.twilio.com', required: true },
        { name: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true }
      ],
      twilio_sms: [
        { name: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://api.twilio.com', required: true },
        { name: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true }
      ],
      sendgrid: [
        { name: 'apiUrl', label: 'API URL', type: 'text', placeholder: 'https://api.sendgrid.com/v3', required: true }
      ],
      external_api: [
        { name: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.credit-bureau.com/v1', required: true },
        { 
          name: 'authType', 
          label: 'Auth Type', 
          type: 'select', 
          options: ['API Key', 'Bearer Token', 'Basic Auth'], 
          required: true 
        }
      ]
    };
    return fields[provider] || [];
  };

  const getCredentialFields = () => {
    const fields: Record<string, any> = {
      resend: [
        { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 're_...', required: true }
      ],
      mocean: [
        { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your API Key', required: true },
        { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'Your API Secret', required: true }
      ],
      twilio_voice: [
        { name: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'Your Auth Token', required: true }
      ],
      twilio_sms: [
        { name: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'Your Auth Token', required: true }
      ],
      sendgrid: [
        { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'SG.xxxxxxxxxxxxx', required: true }
      ],
      external_api: {
        'API Key': [
          { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your API Key', required: true }
        ],
        'Bearer Token': [
          { name: 'bearerToken', label: 'Bearer Token', type: 'password', placeholder: 'Your Bearer Token', required: true }
        ],
        'Basic Auth': [
          { name: 'username', label: 'Username', type: 'text', placeholder: 'Your Username', required: true },
          { name: 'password', label: 'Password', type: 'password', placeholder: 'Your Password', required: true }
        ]
      }
    };
    
    if (provider === 'external_api') {
      return fields.external_api[authType] || [];
    }
    
    return fields[provider] || [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your API Key', required: true }
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const configToSave = {
      ...config,
      authType: authType || config.authType
    };
    
    console.log('🔵 [Modal] Config being saved:', configToSave);
    console.log('🔵 [Modal] Credentials being saved:', credentials);
    
    setLoading(true);
    try {
      await onSave(configToSave, credentials);
    } finally {
      setLoading(false);
    }
  };

  const toggleShowCredential = (fieldName: string) => {
    setShowCredentials({ ...showCredentials, [fieldName]: !showCredentials[fieldName] });
  };

  const handleAuthTypeChange = (value: string) => {
    setAuthType(value);
    setConfig({ ...config, authType: value });
    setCredentials({});
  };

  const configFields = getConfigFields();
  const credentialFields = getCredentialFields();

  const renderField = (field: any) => {
    if (field.type === 'select') {
      return (
        <select
          value={config[field.name] || field.options[0] || ''}
          onChange={(e) => {
            const value = e.target.value;
            if (field.name === 'authType' && provider === 'external_api') {
              handleAuthTypeChange(value);
            } else {
              setConfig({ ...config, [field.name]: value });
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required={field.required}
        >
          {field.options.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type || 'text'}
        value={config[field.name] || ''}
        onChange={(e) => setConfig({ ...config, [field.name]: e.target.value })}
        placeholder={field.placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required={field.required}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Configure {connectorName}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <p className="text-sm text-gray-500 mb-4">
            Enter the configuration details for {provider}
          </p>

          {configFields.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Configuration</p>
              {configFields.map((field: any) => (
                <div key={field.name} className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Credentials</p>
            {credentialFields.map((field: any) => (
              <div key={field.name} className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showCredentials[field.name] ? 'text' : 'password'}
                    value={credentials[field.name] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={field.required}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowCredential(field.name)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCredentials[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}