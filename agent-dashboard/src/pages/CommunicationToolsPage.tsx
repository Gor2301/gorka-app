// CommunicationToolsPage - Agent App.
//
// Reads local_connectors on mount and on every `connector-sync`
// event emitted by the Rust side. The credential lives in local
// SQLCipher and is never read, transported, or displayed by this
// page. The configuration JSON is likewise not shown.
//
// Empty state: the exact sentence from AGENT-APP-SPEC.md v1.3
// section 11.8. Do not paraphrase. Do not add a subtitle, a link,
// or a support email.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { Card, ErrorBanner, Spinner } from '@/components/primitives';
import { localDB, LocalConnector } from '@/services/local.db';
import './CommunicationToolsPage.css';

export default function CommunicationToolsPage() {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestGen = useRef(0);

  const loadConnectors = useCallback(async () => {
    const gen = ++requestGen.current;
    try {
      setError('');
      const rows = await localDB.listLocalConnectors();
      if (gen !== requestGen.current) return;
      setConnectors(rows);
    } catch (err) {
      if (gen !== requestGen.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (gen === requestGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const un = await listen('connector-sync', () => {
  console.log('[F17-DIAG] listener received connector-sync');
          if (!cancelled) loadConnectors();
        });
        if (cancelled) un();
        else unlisten = un;
      } catch (err) {
        console.error('connector-sync listener failed:', err);
      }
      if (!cancelled) loadConnectors();
    })();

    return () => {
      cancelled = true;
      requestGen.current++;
      if (unlisten) unlisten();
    };
  }, [loadConnectors]);

  return (
    <div className="communication-tools-page">
      {error && (
        <div className="communication-tools-page__error">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading ? (
        <div className="communication-tools-page__state">
          <Spinner size={32} />
          <p className="communication-tools-page__state-text">
            Loading communication tools...
          </p>
        </div>
      ) : connectors.length === 0 ? (
        <Card>
          <div className="communication-tools-page__empty">
            <MessageSquare
              size={40}
              className="communication-tools-page__empty-icon"
            />
            <p className="communication-tools-page__empty-text">
              Your administrator has not enabled any communication tools yet. Contact your administrator to enable a channel.
            </p>
          </div>
        </Card>
      ) : (
        <div className="communication-tools-page__grid">
          {connectors.map((c) => (
            <Card key={c.connector_code}>
              <div className="communication-tools-page__card">
                <div className="communication-tools-page__card-header">
                  <h3 className="communication-tools-page__card-title">
                    {c.connector_code}
                  </h3>
                  <span className="communication-tools-page__card-tier">
                    {c.tier}
                  </span>
                </div>
                <div className="communication-tools-page__card-body">
                  <span
                    className={
                      c.status === 'ENABLED'
                        ? 'communication-tools-page__badge communication-tools-page__badge--enabled'
                        : 'communication-tools-page__badge'
                    }
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}