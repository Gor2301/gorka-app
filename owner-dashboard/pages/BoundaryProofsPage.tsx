import React, { useEffect, useState } from 'react';
import OwnerAppShell from '../components/OwnerAppShell';
import { getBoundaryProofs, BoundaryProofRow } from '../services/api';

const BoundaryProofsPage: React.FC = () => {
  const [rows, setRows] = useState<BoundaryProofRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 200 };
      if (filterOrgId) params.organizationId = filterOrgId;
      if (filterEventType !== 'ALL') params.eventType = filterEventType;
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo + 'T23:59:59.999Z').toISOString();
      const result = await getBoundaryProofs(params);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load boundary proof logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    setFilterOrgId('');
    setFilterEventType('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const handleSearch = () => {
    load();
  };

  return (
    <OwnerAppShell>
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111111', marginBottom: '8px' }}>
            Boundary Proof Logs
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '720px' }}>
            Evidence that no debtor data crossed into GORKA cloud infrastructure.
            Every row below records a sync operation and confirms with{' '}
            <strong>debtorDataIncluded = false</strong> that only aggregate counts
            were transmitted.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <input
            type="text"
            placeholder="Organization ID (owner only)"
            value={filterOrgId}
            onChange={(e) => setFilterOrgId(e.target.value)}
            style={{
              flex: 2,
              minWidth: '200px',
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />

          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none',
              cursor: 'pointer',
              flex: 1,
              minWidth: '150px'
            }}
          >
            <option value="ALL">All Event Types</option>
            <option value="METRICS_SYNC">METRICS_SYNC</option>
            <option value="ACTIVITY_SYNC">ACTIVITY_SYNC</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              flex: 0.5,
              minWidth: '120px'
            }}
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              flex: 0.5,
              minWidth: '120px'
            }}
          />

          <button
            onClick={handleSearch}
            style={{
              padding: '8px 20px',
              backgroundColor: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Search
          </button>

          <button
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              border: '1px solid #E3E3E3',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#4A4A4A'
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#6B7280' }}>
          {loading ? 'Loading...' : `Showing ${rows.length} of ${total} entries`}
        </div>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            borderRadius: '8px',
            border: '1px solid #FCA5A5',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E3E3E3',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E3E3E3'
              }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Organization</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Event Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Payload Summary</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500', color: '#6B7280' }}>Debtor Data Included</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                    No boundary proof logs found
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A', fontFamily: 'monospace', fontSize: '12px' }}>
                      {row.organizationId}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: '#F4F0FF',
                        color: '#7C3AED'
                      }}>
                        {row.eventType}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A', fontFamily: 'monospace', fontSize: '11px', maxWidth: '360px', wordBreak: 'break-all' }}>
                      {JSON.stringify(row.payloadSummary)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: row.debtorDataIncluded ? '#FEE2E2' : '#D1FAE5',
                        color: row.debtorDataIncluded ? '#991B1B' : '#065F46'
                      }}>
                        {row.debtorDataIncluded ? 'TRUE' : 'FALSE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E3E3E3',
          fontSize: '12px',
          color: '#6B7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🛡️</span>
          <span>
            Every entry in this table records a sync operation. The
            <strong> Debtor Data Included </strong>
            column must always read FALSE. A TRUE would indicate an architectural
            violation and should be investigated immediately.
          </span>
        </div>
      </div>
    </OwnerAppShell>
  );
};

export default BoundaryProofsPage;