// CopilotPage - Agent App.
//
// Slice 5c. Read-only status page. Lists enabled AI providers,
// summarizes how the Copilot works, and shows the configured
// disclosure text. No actions.

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, ErrorBanner, Spinner } from '@/components/primitives';
import { localDB, CopilotProviderRow } from '@/services/local.db';
import './CopilotPage.css';

export default function CopilotPage() {
  const [providers, setProviders] = useState<CopilotProviderRow[]>([]);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setError('');
        const [provs, text] = await Promise.all([
          localDB.listCopilotProviders(),
          localDB.getDisclosureText(),
        ]);
        setProviders(provs);
        setDisclosure(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="copilot-page">
      <header className="copilot-page__header">
        <Sparkles size={20} strokeWidth={1.8} />
        <h1 className="copilot-page__title">Copilot</h1>
      </header>

      {error && <ErrorBanner message={error} />}

      <Card>
        <h2 className="copilot-page__section-title">Providers</h2>
        {loading ? (
          <div className="copilot-page__center">
            <Spinner />
          </div>
        ) : providers.length === 0 ? (
          <p className="copilot-page__muted">
            No AI provider is enabled for this organization on this device.
          </p>
        ) : (
          <table className="copilot-page__table">
            <thead>
              <tr>
                <th>Connector</th>
                <th>Tier</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.connector_code}>
                  <td>{p.connector_code}</td>
                  <td>{p.tier}</td>
                  <td>{p.model ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="copilot-page__section-title">How it works</h2>
        <p className="copilot-page__paragraph">
          The Copilot sends the AI provider a coarse summary of the debtor
          only: amount range, days-overdue range, communication counts, and
          engagement bands. Exact names, contact details, exact amounts, and
          message history never leave the device.
        </p>
        <p className="copilot-page__paragraph">
          The provider returns a structured recommendation and a draft
          message. The draft is advisory. Nothing is sent without your
          approval.
        </p>
      </Card>

      <Card>
        <h2 className="copilot-page__section-title">What to expect</h2>
        <ul className="copilot-page__list">
          <li>Recommendations expire 72 hours after creation.</li>
          <li>
            When the AI provider is unavailable, a local fallback produces a
            rule-based recommendation. It is labeled{' '}
            <em>Fallback — AI unavailable</em>.
          </li>
          <li>The rationale is labeled <em>AI explanation — unverified</em>.</li>
          <li>
            Fact-validation flags block the send until the draft is edited:
            dollar amounts, dates, references, prior promises, and legal or
            credit consequences are cross-checked against local records.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="copilot-page__section-title">Disclosure</h2>
        {disclosure && disclosure.trim() !== '' ? (
          <pre className="copilot-page__disclosure">{disclosure}</pre>
        ) : (
          <p className="copilot-page__muted">
            No disclosure text configured.
          </p>
        )}
      </Card>
    </div>
  );
}