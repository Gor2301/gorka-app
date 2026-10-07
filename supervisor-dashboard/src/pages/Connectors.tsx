import { useState, useEffect } from 'react';
import { connectorsService } from '../services/connectors.service';
import type { CatalogEntry, EnablementRow } from '../services/connectors.service';
import { invoke } from '@tauri-apps/api/core';
import {
  RefreshCw,
  Mail,
  MessageSquare,
  Phone,
  Database,
  Bot,
  Power,
} from 'lucide-react';
import { ConfigurationModal } from '../components/Connectors/ConfigurationModal';

interface DisplayRow {
  catalog: CatalogEntry;
  enablement: EnablementRow | null;
}

export default function Connectors() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [catalog, enablements] = await Promise.all([
        connectorsService.listCatalog(),
        connectorsService.listEnablements(),
      ]);
      const byCode = new Map(enablements.map((e) => [e.connectorCode, e]));
      const merged: DisplayRow[] = catalog.map((c) => ({
        catalog: c,
        enablement: byCode.get(c.code) ?? null,
      }));
      setRows(merged);
    } catch (err: any) {
      console.error('Failed to load connectors:', err);
      setError(err?.message || 'Failed to load connectors');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = async (row: DisplayRow) => {
    if (busyCode) return;
    setBusyCode(row.catalog.code);
    try {
      await connectorsService.enable(row.catalog.code);
      await load();
    } catch (err: any) {
      alert('Failed to connect ' + row.catalog.name + ': ' + (err?.message || 'Unknown error'));
    } finally {
      setBusyCode(null);
    }
  };

  const handleDisconnect = async (row: DisplayRow) => {
    if (busyCode) return;
    if (!confirm('Disconnect ' + row.catalog.name + '?')) return;
    setBusyCode(row.catalog.code);
    try {
      await connectorsService.disable(row.catalog.code);
      await load();
    } catch (err: any) {
      alert('Failed to disconnect ' + row.catalog.name + ': ' + (err?.message || 'Unknown error'));
    } finally {
      setBusyCode(null);
    }
  };

  const handleAddCredentials = (row: DisplayRow) => {
    setSelectedCatalog(row.catalog);
    setShowConfig(true);
  };

  const handleByopSave = async (config: Record<string, any>, credentials: Record<string, any>) => {
    if (!selectedCatalog) return;
    try {
      const credentialJson = JSON.stringify(credentials);
      const credentialBytes = Array.from(new TextEncoder().encode(credentialJson));
      await invoke("write_local_connector_credential", {
        connectorCode: selectedCatalog.code,
        tier: "TIER2",
        configuration: JSON.stringify(config),
        credentialBytes,
      });
      await connectorsService.enable(selectedCatalog.code);
      setShowConfig(false);
      setSelectedCatalog(null);
      await load();
    } catch (err: any) {
      alert('Failed to save credentials: ' + (err?.message || String(err)));
    }
  };

  const categoryIcon = (category: CatalogEntry['category']) => {
    switch (category) {
      case 'EMAIL':
        return <Mail className="w-5 h-5 text-gray-600" />;
      case 'SMS':
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
      case 'VOICE':
        return <Phone className="w-5 h-5 text-gray-600" />;
      case 'AI':
        return <Bot className="w-5 h-5 text-gray-600" />;
      default:
        return <Database className="w-5 h-5 text-gray-600" />;
    }
  };

  const statusStyle = (status: string | undefined) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-green-100 text-green-700';
      case 'ERROR':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const renderCard = (row: DisplayRow) => {
    const { catalog, enablement } = row;
    const isTier1 = catalog.isManagedByGorka;
    const isConnected = enablement?.status === 'CONNECTED';
    const isBusy = busyCode === catalog.code;

    return (
      <div key={catalog.code} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>{categoryIcon(catalog.category)}</div>
            <div>
              <h3 className="font-medium text-gray-900">{catalog.name}</h3>
              <p className="text-sm text-gray-500">{catalog.provider}</p>
            </div>
          </div>
          <span className={'px-2 py-1 rounded-full text-xs font-medium ' + statusStyle(enablement?.status)}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {catalog.description && (
          <p className="text-sm text-gray-600 mb-4">{catalog.description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isConnected && catalog.mvpStatus === 'COMING_SOON' && (
            <button disabled title="This connector is coming soon." className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-500 text-sm rounded-lg cursor-not-allowed">
              <Power className="w-4 h-4" />
              Coming soon
            </button>
          )}

          {!isConnected && catalog.mvpStatus === 'LIVE' && isTier1 && (
            <button onClick={() => handleConnect(row)} disabled={isBusy} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              <Power className="w-4 h-4" />
              {isBusy ? 'Connecting...' : 'Connect'}
            </button>
          )}

          {!isConnected && catalog.mvpStatus === 'LIVE' && !isTier1 && (
            <button onClick={() => handleAddCredentials(row)} disabled={isBusy} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              <Power className="w-4 h-4" />
              Add my credentials
            </button>
          )}

          {isConnected && (
            <button onClick={() => handleDisconnect(row)} disabled={isBusy} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
              <Power className="w-4 h-4" />
              {isBusy ? 'Disconnecting...' : (isTier1 ? 'Disconnect' : 'Disable')}
            </button>
          )}
        </div>
      </div>
    );
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
          <button onClick={load} className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const gorkaRows = rows.filter((r) => r.catalog.isManagedByGorka);
  const byopRows = rows.filter((r) => !r.catalog.isManagedByGorka);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="text-gray-500 mt-1">
            Connect GORKA to external services for email, SMS, and more
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">GORKA built-in</h2>
        <p className="text-sm text-gray-500 mb-4">Vendors provisioned by GORKA on your behalf.</p>
        {gorkaRows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gorkaRows.map(renderCard)}
          </div>
        ) : (
          <div className="text-gray-500 py-4">No GORKA built-in connectors available.</div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Bring your own</h2>
        <p className="text-sm text-gray-500 mb-4">Connect a vendor using your own account.</p>
        {byopRows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byopRows.map(renderCard)}
          </div>
        ) : (
          <div className="text-gray-500 py-4">No bring-your-own connectors yet.</div>
        )}
      </section>

      <ConfigurationModal
        isOpen={showConfig}
        onClose={() => { setShowConfig(false); setSelectedCatalog(null); }}
        onSave={handleByopSave}
        connectorName={selectedCatalog?.name || ""}
        provider={selectedCatalog?.provider || ""}
      />
    </div>
  );
}

