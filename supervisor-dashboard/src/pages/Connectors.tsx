import { useState, useEffect } from 'react';
import { connectorsService } from '../services/connectors.service';
import type { CatalogEntry, EnablementRow, CredentialSchema } from '../services/connectors.service';
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
  maxWidth: '1100px',
  margin: '0 auto',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: '24px',
};

const refreshBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: 'white',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  cursor: 'pointer',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '28px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 4px 0',
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 12px 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '12px',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  backgroundColor: 'white',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
  margin: 0,
};

const cardProviderStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '2px 0 0 0',
};

const cardDescStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#4b5563',
  margin: '8px 0 12px 0',
};

const statusBadgeStyle = (connected: boolean): React.CSSProperties => ({
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: '6px',
  backgroundColor: connected ? '#dcfce7' : '#f3f4f6',
  color: connected ? '#166534' : '#6b7280',
});

const sourceBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: '4px',
  backgroundColor: '#ede9fe',
  color: '#5b21b6',
  marginLeft: '6px',
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: '#7C3AED',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const btnGhostStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: 'white',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  cursor: 'pointer',
};

const btnDangerStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: 'white',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  cursor: 'pointer',
};

const btnDisabledStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 500,
  backgroundColor: '#f3f4f6',
  color: '#9ca3af',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  cursor: 'not-allowed',
};

const emptyTextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
};

const byopSubTableStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  marginBottom: '12px',
  backgroundColor: 'white',
};

const byopSubTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 4px 0',
};

const byopSubSubStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 12px 0',
};

const dropdownRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
};

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '13px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  backgroundColor: 'white',
  color: '#374151',
  minWidth: '220px',
};

export default function Connectors() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const [showDeclaration, setShowDeclaration] = useState(false);
  const [declarationTier, setDeclarationTier] = useState<'TIER1' | 'TIER2'>('TIER2');
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedByopProvider, setSelectedByopProvider] = useState<string>('');

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

  useEffect(() => { load(); }, []);

  const handleConnect = (row: DisplayRow) => {
    if (busyCode) return;
    setSelectedCatalog(row.catalog);
    setDeclarationTier('TIER1');
    setShowDeclaration(true);
  };

  const handleTier1Confirm = async () => {
    if (!selectedCatalog || busyCode) return;
    const catalog = selectedCatalog;
    setBusyCode(catalog.code);
    try {
      const result = await connectorsService.enable(catalog.code, {
        tier1Acknowledged: true,
      });

      // Enable-if-absent: the connector is already on the server.
      if (result.alreadyEnabled) {
        setShowDeclaration(false);
        setSelectedCatalog(null);
        await load();
        return;
      }

      // F12: no GORKA credential for this code. The backend wrote a
      // CONNECTED row but no credential exists, so the connector can
      // never send. Roll the row back before reporting the failure.
      if (!result.credential) {
        try {
          await connectorsService.disable(catalog.code);
        } catch (rollbackErr) {
          console.error('Rollback after failed enable also failed:', rollbackErr);
        }
        setShowDeclaration(false);
        setSelectedCatalog(null);
        alert('GORKA-managed ' + catalog.name + ' is not configured on this server.');
        await load();
        return;
      }

      const credentialBytes = Array.from(
        new TextEncoder().encode(result.credential.value),
      );
      await invoke('write_local_connector_credential', {
        connectorCode: catalog.code,
        tier: 'TIER1',
        configuration: JSON.stringify(result.credential.configuration),
        credentialBytes,
      });

      setShowDeclaration(false);
      setSelectedCatalog(null);
      await load();
    } catch (err: any) {
      alert('Failed to connect ' + catalog.name + ': ' + (err?.message || 'Unknown error'));
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

  const handleByopProviderSelect = (code: string) => {
    setSelectedByopProvider(code);
  };

  const handleByopAdd = () => {
    if (!selectedByopProvider) return;
    const row = rows.find((r) => r.catalog.code === selectedByopProvider);
    if (!row) return;
    setSelectedCatalog(row.catalog);
    setDeclarationTier('TIER2');
    setShowDeclaration(true);
  };

  const handleDeclarationAccept = () => {
    setShowDeclaration(false);
    if (declarationTier === 'TIER1') {
      handleTier1Confirm();
      return;
    }
    if (!selectedCatalog) return;
    setShowConfigModal(true);
  };

  const handleByopSave = async (
    config: Record<string, any>,
    credentials: Record<string, any>,
  ) => {
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
      setShowConfigModal(false);
      setSelectedCatalog(null);
      setSelectedByopProvider('');
      await load();
    } catch (err: any) {
      alert('Failed to save credentials: ' + (err?.message || String(err)));
    }
  };

  const closeConfigModal = () => {
    setShowConfigModal(false);
    setSelectedCatalog(null);
  };

  const renderCard = (row: DisplayRow, section: 'gorka' | 'byop') => {
    const { catalog, enablement } = row;
    const isConnected = enablement?.status === 'CONNECTED';
    const isBusy = busyCode === catalog.code;
    const sourceLabel =
      enablement?.credentialSource === 'BYOP' ? 'YOUR ACCOUNT'
      : enablement?.credentialSource === 'GORKA' ? 'GORKA'
      : null;

    return (
      <div key={catalog.code} style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h3 style={cardTitleStyle}>
              {catalog.name}
              {isConnected && sourceLabel && (
                <span style={sourceBadgeStyle}>{sourceLabel}</span>
              )}
            </h3>
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
          {section === 'gorka' && !isConnected && catalog.mvpStatus === 'COMING_SOON' && (
            <button style={btnDisabledStyle} disabled title="This connector is coming soon.">
              Coming soon
            </button>
          )}
          {section === 'gorka' && !isConnected && catalog.mvpStatus === 'LIVE' && (
            <button style={btnPrimaryStyle} onClick={() => handleConnect(row)} disabled={isBusy}>
              {isBusy ? 'Connecting...' : 'Connect (GORKA)'}
            </button>
          )}
          {isConnected && (
            <button style={btnDangerStyle} onClick={() => handleDisconnect(row)} disabled={isBusy}>
              {isBusy ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={emptyTextStyle}>Loading connectors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={emptyTextStyle}>Error: {error}</div>
      </div>
    );
  }

  // F14 / Rule C: section follows the credential source, not the
  // catalog flag. GORKA-built-in holds everything that is not
  // BYOP-connected (including unconnected offers). The BYOP section
  // holds rows the admin connected with their own credential.
  const gorkaSectionRows = rows.filter(
    (r) => r.enablement?.credentialSource !== 'BYOP',
  );
  const byopConnectedRows = rows.filter(
    (r) => r.enablement?.credentialSource === 'BYOP' && r.enablement.status === 'CONNECTED',
  );

  // BYOP dropdown eligibility (Q1-B-1):
  //   credentialSchema present AND mvpStatus LIVE AND not already CONNECTED.
  // custom-api has no schema (F13), so it is excluded automatically.
  const byopEligible = rows.filter((r) =>
    r.catalog.credentialSchema &&
    r.catalog.mvpStatus === 'LIVE' &&
    (!r.enablement || r.enablement.status !== 'CONNECTED'),
  );

  const selectedRow = rows.find((r) => r.catalog.code === selectedCatalog?.code) ?? null;
  const selectedSchema: CredentialSchema | null =
    selectedRow?.catalog.credentialSchema ?? null;

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
        {gorkaSectionRows.length > 0 ? (
          <div style={gridStyle}>
            {gorkaSectionRows.map((r) => renderCard(r, 'gorka'))}
          </div>
        ) : (
          <div style={emptyTextStyle}>No GORKA built-in connectors available.</div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Bring your own</h3>
        <p style={sectionSubStyle}>Connect a vendor using your own account.</p>

        <div style={byopSubTableStyle}>
          <h4 style={byopSubTitleStyle}>Use my own account</h4>
          <p style={byopSubSubStyle}>
            Pick a provider, then enter your own credentials.
          </p>
          <div style={dropdownRowStyle}>
            <select
              style={selectStyle}
              value={selectedByopProvider}
              onChange={(e) => handleByopProviderSelect(e.target.value)}
            >
              <option value="">Select a provider...</option>
              {byopEligible.map((r) => (
                <option key={r.catalog.code} value={r.catalog.code}>
                  {r.catalog.name}
                </option>
              ))}
            </select>
            <button
              style={btnPrimaryStyle}
              onClick={handleByopAdd}
              disabled={!selectedByopProvider}
            >
              Add
            </button>
          </div>
          {byopConnectedRows.length > 0 && (
            <div style={{ ...gridStyle, marginTop: '12px' }}>
              {byopConnectedRows.map((r) => renderCard(r, 'byop'))}
            </div>
          )}
        </div>

        <div style={byopSubTableStyle}>
          <h4 style={byopSubTitleStyle}>New connectors</h4>
          <p style={byopSubSubStyle}>
            Add any provider from scratch. Coming soon.
          </p>
          <button style={btnDisabledStyle} disabled>
            Add (coming soon)
          </button>
        </div>

        <div style={byopSubTableStyle}>
          <h4 style={byopSubTitleStyle}>Data sources</h4>
          <p style={byopSubSubStyle}>
            Credit bureaus, skip tracing, and other data vendors. Coming soon.
          </p>
          <button style={btnDisabledStyle} disabled>
            Add (coming soon)
          </button>
        </div>
      </section>

      <DeclarationModal
        isOpen={showDeclaration}
        onClose={() => { setShowDeclaration(false); setSelectedCatalog(null); }}
        onAccept={handleDeclarationAccept}
        connectorName={selectedCatalog?.name || ''}
        tier={declarationTier}
      />

      <ConfigurationModal
        isOpen={showConfigModal}
        onClose={closeConfigModal}
        onSave={handleByopSave}
        connectorName={selectedCatalog?.name || ''}
        provider={selectedCatalog?.provider || ''}
        credentialSchema={selectedSchema}
      />
    </div>
  );
}