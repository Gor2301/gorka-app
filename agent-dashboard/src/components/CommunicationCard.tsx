import { useEffect, useState } from 'react';
import { MessageSquare, Mail, Phone } from 'lucide-react';
import { localDB, LocalConnector } from '@/services/local.db';
import { ErrorBanner } from '@/components/primitives';
import SendMessageModal from '@/components/SendMessageModal';
import CallComingSoonModal from '@/components/CallComingSoonModal';
import './CommunicationCard.css';

interface CommunicationCardProps {
  debtorId: string;
  debtorName: string;
  onSent: () => void;
}

function channelFor(code: string): 'SMS' | 'Email' | 'Voice' | 'Other' {
  if (code.endsWith('-sms')) return 'SMS';
  if (code.endsWith('-email')) return 'Email';
  if (code.endsWith('-voice')) return 'Voice';
  return 'Other';
}

function friendlyName(code: string): string {
  return code
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function CommunicationCard({
  debtorId,
  debtorName,
  onSent,
}: CommunicationCardProps) {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSendCode, setActiveSendCode] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const rows = await localDB.listLocalConnectors();
        setConnectors(rows.filter((r) => r.status === 'ENABLED'));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sms = connectors.filter((c) => channelFor(c.connector_code) === 'SMS');
  const email = connectors.filter(
    (c) => channelFor(c.connector_code) === 'Email',
  );
  const noMessagingConnectors = sms.length === 0 && email.length === 0;

  const handleSendComplete = () => {
    setActiveSendCode(null);
    onSent();
  };

  return (
    <>
      <div className="communication-card__header">
        <h2 className="communication-card__heading">Communication</h2>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <p className="communication-card__muted">Loading connectors...</p>
      ) : (
        <>
          {noMessagingConnectors && (
            <p className="communication-card__muted">
              No connectors enabled. Ask your administrator.
            </p>
          )}

          <div className="communication-card__groups">
            {sms.length > 0 && (
              <div className="communication-card__group">
                <span className="communication-card__group-label">SMS</span>
                <div className="communication-card__buttons">
                  {sms.map((c) => (
                    <button
                      key={c.connector_code}
                      type="button"
                      className="communication-card__button"
                      onClick={() => setActiveSendCode(c.connector_code)}
                    >
                      <MessageSquare size={14} />
                      {friendlyName(c.connector_code)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {email.length > 0 && (
              <div className="communication-card__group">
                <span className="communication-card__group-label">Email</span>
                <div className="communication-card__buttons">
                  {email.map((c) => (
                    <button
                      key={c.connector_code}
                      type="button"
                      className="communication-card__button"
                      onClick={() => setActiveSendCode(c.connector_code)}
                    >
                      <Mail size={14} />
                      {friendlyName(c.connector_code)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="communication-card__group">
              <span className="communication-card__group-label">Voice</span>
              <div className="communication-card__buttons">
                <button
                  type="button"
                  className="communication-card__button"
                  onClick={() => setShowCallModal(true)}
                >
                  <Phone size={14} />
                  Call
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSendCode && (
        <SendMessageModal
          debtorId={debtorId}
          debtorName={debtorName}
          presetConnectorCode={activeSendCode}
          onClose={() => setActiveSendCode(null)}
          onSent={handleSendComplete}
        />
      )}

      {showCallModal && (
        <CallComingSoonModal onClose={() => setShowCallModal(false)} />
      )}
    </>
  );
}