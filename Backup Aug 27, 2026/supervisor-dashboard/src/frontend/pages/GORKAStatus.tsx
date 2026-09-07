import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

interface ServiceStatus {
  id: string;
  serviceName: string;
  status: 'online' | 'offline' | 'degraded';
  statusMessage: string | null;
  lastCheck: string;
  responseTime: number | null;
}

export function GORKAStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setServices(data.data || []);
      setLastUpdated(new Date(data.lastUpdated));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
  };

  const onlineCount = services.filter(s => s.status === 'online').length;
  const totalCount = services.length;
  const allOnline = onlineCount === totalCount && totalCount > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading status...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            GORKA Status
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'No updates yet'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${
            refreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-red-600">
          Error: {error}
        </div>
      )}

      {/* Overall Status */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border">
          <div className="flex items-center gap-4">
            {allOnline ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500" />
                <div>
                  <h2 className="text-xl font-bold text-green-600 dark:text-green-400">
                    All Systems Operational
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    All {totalCount} services are running normally
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
                <div>
                  <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    Partial Service Disruption
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    {onlineCount}/{totalCount} services operational
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const statusConfig = {
    online: {
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
    },
    offline: {
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
    },
    degraded: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
  };

  const config = statusConfig[service.status] || statusConfig.offline;
  const Icon = config.icon;

  const serviceDisplayName = {
    dashboard: 'Dashboard',
    api: 'API',
    database: 'Database',
    connectors: 'Connectors',
    jobs: 'Background Jobs'
  }[service.serviceName] || service.serviceName;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border ${config.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg capitalize">
            {serviceDisplayName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <span className={`text-sm font-medium capitalize ${config.color}`}>
              {service.status}
            </span>
          </div>
        </div>
        {service.responseTime !== null && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {service.responseTime}ms
          </span>
        )}
      </div>
      
      {service.statusMessage && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {service.statusMessage}
        </p>
      )}

      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Checked: {new Date(service.lastCheck).toLocaleTimeString()}
      </div>
    </div>
  );
}