// CommunicationToolsPage - Agent App.
//
// Reads local_connectors on mount and renders one card per
// enabled connector. The credential lives in local SQLCipher and
// is never read, transported, or displayed by this page. The
// configuration JSON is likewise not shown.
//
// Empty state: the exact sentence from AGENT-APP-SPEC.md v1.3
// section 11.8. Do not paraphrase. Do not add a subtitle, a link,
// or a support email.

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, ErrorBanner, Spinner } from '@/components/primitives';
import { localDB, LocalConnector } from '@/services/local.db';
import './CommunicationToolsPage.css';

export default function CommunicationToolsPage() {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const rows = await localDB.listLocalConnectors();
        setConnectors(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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