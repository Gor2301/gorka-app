import { useState, useEffect } from 'react';
import { connectorsService } from '../services/connectors.service';
import type { Connector } from '../services/connectors.service';
import { 
  RefreshCw, 
  Mail, 
  MessageSquare, 
  Phone, 
  Database,
  Link,
  Unlink,
  CheckCircle,
  } from 'lucide-react';
import { DeclarationModal } from '../components/Connectors/DeclarationModal';
import { ConfigurationModal } from '../components/Connectors/ConfigurationModal';

export default function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      setError(null);
      let data = await connectorsService.getConnectors();

      const externalApiExists = data.some(c => c.provider === 'external_api');

      if (!externalApiExists) {
        const externalApiConnector: Connector = {
          id: 'external-api-default',
          name: 'External API',
          description: 'Connect to any external REST API (credit bureaus, scoring systems, etc.)',
          type: 'DATA_SOURCE',
          category: 'EXTERNAL',
          provider: 'external_api',
          isDefault: false,
          isEnabled: true,
          status: 'DISCONNECTED',
          acknowledged: false,
          hasCredentials: false
        };
        data = [externalApiConnector, ...data];
      }

      setConnectors(data || []);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Failed to load connectors');
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectors();
  }, []);

  const handleConnect = (connector: Connector) => {
    setSelectedConnector(connector);
    setShowDeclaration(true);
  };

  const handleAcceptDeclaration = () => {
    setShowDeclaration(false);
    setShowConfig(true);
  };

  const handleSaveConfiguration = async (config: Record<string, any>, credentials: Record<string, any>) => {
    if (!selectedConnector) return;

    try {
      await connectorsService.connectConnector(selectedConnector.id, {
        acknowledged: true,
        config,
        credentials
      });

      alert(`Successfully connected to ${selectedConnector.name}!`);
      setShowConfig(false);
      setSelectedConnector(null);
      await loadConnectors();
    } catch (err) {
      console.error('Failed to connect:', err);
      alert('Failed to connect. Please check your credentials.');
    }
  };

  const handleDisconnect = async (connector: Connector) => {
    if (!confirm(`Are you sure you want to disconnect ${connector.name}?`)) return;

    try {
      await connectorsService.disconnectConnector(connector.id);
      alert(`Successfully disconnected ${connector.name}`);
      await loadConnectors();
    } catch (err) {
      console.error('Failed to disconnect:', err);
      alert('Failed to disconnect');
    }
  };

  const handleTest = async (connector: Connector) => {
    try {
      await connectorsService.testConnector(connector.id);
      alert('✅ Test successful!');
      await loadConnectors();
    } catch (err) {
      alert('❌ Test failed. Please check the connector configuration.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p><strong>Error:</strong> {error}</p>
          <button
            onClick={loadConnectors}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    CONNECTED: 'bg-green-100 text-green-700',
    DISCONNECTED: 'bg-gray-100 text-gray-700',
    ERROR: 'bg-red-100 text-red-700'
  };

  const typeIcons: Record<string, React.ReactNode> = {
    EMAIL: <Mail className="w-5 h-5 text-gray-600" />,
    SMS: <MessageSquare className="w-5 h-5 text-gray-600" />,
    VOICE: <Phone className="w-5 h-5 text-gray-600" />,
    DATA_SOURCE: <Database className="w-5 h-5 text-gray-600" />
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="text-gray-500 mt-1">
            Connect GORKA to external services for email, SMS, and more
          </p>
        </div>
        <button
          onClick={loadConnectors}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors && connectors.length > 0 ? (
          connectors.map((connector) => {
            const statusColor = statusColors[connector.status] || 'bg-gray-100 text-gray-700';
            const typeIcon = typeIcons[connector.type] || <Database className="w-5 h-5 text-gray-600" />;

            return (
              <div key={connector.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-gray-600">{typeIcon}</div>
                    <div>
                      <h3 className="font-medium text-gray-900">{connector.name}</h3>
                      <p className="text-sm text-gray-500">{connector.provider}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                    {connector.status}
                  </span>
                </div>

                {connector.description && (
                  <p className="text-sm text-gray-600 mb-4">{connector.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {connector.status === 'DISCONNECTED' && (
                    <button
                      onClick={() => handleConnect(connector)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      <Link className="w-4 h-4" />
                      Connect
                    </button>
                  )}

                  {connector.status === 'CONNECTED' && connector.hasCredentials && (
                    <>
                      <button
                        onClick={() => handleTest(connector)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Test
                      </button>
                      <button
                        onClick={() => handleDisconnect(connector)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <Unlink className="w-4 h-4" />
                        Disconnect
                      </button>
                      <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                      </span>
                    </>
                  )}

                  {connector.isDefault && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                      Default
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center text-gray-500 py-8">
            No connectors found.
          </div>
        )}
      </div>

      <DeclarationModal
        isOpen={showDeclaration}
        onClose={() => setShowDeclaration(false)}
        onAccept={handleAcceptDeclaration}
        connectorName={selectedConnector?.name || ''}
      />

      <ConfigurationModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onSave={handleSaveConfiguration}
        connectorName={selectedConnector?.name || ''}
        provider={selectedConnector?.provider || ''}
      />
    </div>
  );
}