import { useState, useEffect } from 'react';
import { connectorsService } from '../services/connectors.service';
import type { CatalogEntry, EnablementRow } from '../services/connectors.service';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw } from 'lucide-react';
import { ConfigurationModal } from '../components/Connectors/ConfigurationModal';
import { DeclarationModal } from '../components/Connectors/DeclarationModal';

interface DisplayRow {
  catalog: CatalogEntry;
  enablement: EnablementRow | null;
}

const pageStyle: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  textAlign: 'left',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '32px',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '40px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 4px 0',
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 16px 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '16px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#111827',
  margin: 0,
};

const cardProviderStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '2px 0 0 0',
};

const cardDescStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#4b5563',
  margin: 0,
  lineHeight: 1.4,
};

const statusBadgeStyle = (connected: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.3px',
  backgroundColor: connected ? '#dcfce7' : '#f3f4f6',
  color: connected ? '#15803d' : '#6b7280',
});

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: 'auto',
  flexWrap: 'wrap',
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '8px',
  backgroundColor: '#7C3AED',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
};

const btnDangerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '8px',
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  cursor: 'pointer',
};

const btnDisabledStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '8px',
  backgroundColor: '#f3f4f6',
  color: '#9ca3af',
  border: '1px solid #e5e7eb',
  cursor: 'not-allowed',
};

const refreshBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  borderRadius: '8px',
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
};

export default function Connectors() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [showDeclaration, setShowDeclaration] = useState(false);
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
    setShowDeclaration(true);
  };

  const handleDeclarationAccept = () => {
    setShowDeclaration(false);
    setShowConfig(true);
  };

  const handleByopSave = async (config: Record<string, any>, credentials: Record<string, any>) => {
    if (!selectedCatalog) return;
    try {
      const credentialJson = JSON.stringify(credentials);
      const credentialBytes = Array.from(new TextEncoder().encode(credentialJson));
      await invoke('write_local_connector_credential', {
        connectorCode: selectedCatalog.code,
        tier: 'TIER2',
        configuration: JSON.stringify(config),
        credentialBytes,
      });
      await connectorsService.enable(selectedCatalog.code, { zone3Acknowledged: true });
      setShowConfig(false);
      setSelectedCatalog(null);
      await load();
    } catch (err: any) {
      alert('Failed to save credentials: ' + (err?.message || String(err)));
    }
  };

  const renderCard = (row: DisplayRow) => {
    const { catalog, enablement } = row;
    const isTier1 = catalog.isManagedByGorka;
    const isConnected = enablement?.status === 'CONNECTED';
    const isBusy = busyCode === catalog.code;

    return (
      <div key={catalog.code} style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h3 style={cardTitleStyle}>{catalog.name}</h3>
            <p style={cardProviderStyle}>{catalog.provider}</p>
          </div>
          <span style={statusBadgeStyle(isConnected)}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {catalog.description && (
          <p style={cardDescStyle}>{catalog.description}</p>
        )}

        <div style={actionsRowStyle}>
          {!isConnected && catalog.mvpStatus === 'COMING_SOON' && (
            <button style={btnDisabledStyle} disabled title="This connector is coming soon.">
              Coming soon
            </button>
          )}

          {!isConnected && catalog.mvpStatus === 'LIVE' && isTier1 && (
            <button
              style={btnPrimaryStyle}
              onClick={() => handleConnect(row)}
              disabled={isBusy}
            >
              {isBusy ? 'Connecting...' : 'Connect'}
            </button>
          )}

          {!isConnected && catalog.mvpStatus === 'LIVE' && !isTier1 && (
            <button
              style={btnPrimaryStyle}
              onClick={() => handleAddCredentials(row)}
              disabled={isBusy}
            >
              Add my credentials
            </button>
          )}

          {isConnected && (
            <button
              style={btnDangerStyle}
              onClick={() => handleDisconnect(row)}
              disabled={isBusy}
            >
              {isBusy ? 'Disconnecting...' : (isTier1 ? 'Disconnect' : 'Disable')}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, textAlign: 'center', color: '#6b7280' }}>
        Loading connectors...
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
        }}>
          <p style={{ margin: '0 0 12px 0' }}><strong>Error:</strong> {error}</p>
          <button style={refreshBtnStyle} onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const gorkaRows = rows.filter((r) => r.catalog.isManagedByGorka);
  const byopRows = rows.filter((r) => !r.catalog.isManagedByGorka);

  return (
    <div style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: '#111827' }}>
            Connectors
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Connect GORKA to external services for email, SMS, and more.
          </p>
        </div>
        <button style={refreshBtnStyle} onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>GORKA built-in</h3>
        <p style={sectionSubStyle}>Vendors provisioned by GORKA on your behalf.</p>
        {gorkaRows.length > 0 ? (
          <div style={gridStyle}>{gorkaRows.map(renderCard)}</div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>No GORKA built-in connectors available.</div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Bring your own</h3>
        <p style={sectionSubStyle}>Connect a vendor using your own account.</p>
        {byopRows.length > 0 ? (
          <div style={gridStyle}>{byopRows.map(renderCard)}</div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>No bring-your-own connectors yet.</div>
        )}
      </section>

      <DeclarationModal
        isOpen={showDeclaration}
        onClose={() => { setShowDeclaration(false); setSelectedCatalog(null); }}
        onAccept={handleDeclarationAccept}
        connectorName={selectedCatalog?.name || ''}
      />

      <ConfigurationModal
        isOpen={showConfig}
        onClose={() => { setShowConfig(false); setSelectedCatalog(null); }}
        onSave={handleByopSave}
        connectorName={selectedCatalog?.name || ''}
        provider={selectedCatalog?.provider || ''}
      />
    </div>
  );
}