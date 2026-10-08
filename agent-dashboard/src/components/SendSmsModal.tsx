import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, ErrorBanner } from '@/components/primitives';
import {
  localDB,
  LocalConnector,
  SendConnectorMessageInput,
} from '@/services/local.db';
import './SendSmsModal.css';

interface SendSmsModalProps {
  debtorId: string;
  debtorName: string;
  initialPhone: string;
  onClose: () => void;
  onSent: () => void;
}

export default function SendSmsModal({
  debtorId,
  debtorName,
  initialPhone,
  onClose,
  onSent,
}: SendSmsModalProps) {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [to, setTo] = useState(initialPhone);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const rows = await localDB.listLocalConnectors();
        const sms = rows.filter(
          (r) => r.status === 'ENABLED' && r.connector_code.endsWith('-sms'),
        );
        setConnectors(sms);
        if (sms.length > 0) setSelectedCode(sms[0].connector_code);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handleSend = async () => {
    if (!selectedCode) {
      setError('No SMS connector enabled on this device.');
      return;
    }
    if (!to.trim()) {
      setError('Recipient phone number is required.');
      return;
    }
    if (!body.trim()) {
      setError('Message body is required.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const input: SendConnectorMessageInput = {
        connectorCode: selectedCode,
        debtorId,
        to: to.trim(),
        body: body.trim(),
      };
      await localDB.sendConnectorMessage(input);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="send-sms-modal__overlay">
      <div className="send-sms-modal">
        <div className="send-sms-modal__header">
          <h2 className="send-sms-modal__title">Send SMS to {debtorName}</h2>
          <button
            type="button"
            className="send-sms-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="send-sms-modal__body">
          {error && <ErrorBanner message={error} />}

          {connectors.length === 0 ? (
            <p className="send-sms-modal__muted">
              No SMS connector is enabled on this device. Ask your
              administrator to enable one.
            </p>
          ) : (
            <>
              {connectors.length > 1 && (
                <label className="send-sms-modal__field">
                  <span className="send-sms-modal__label">Send via</span>
                  <select
                    className="send-sms-modal__select"
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                  >
                    {connectors.map((c) => (
                      <option key={c.connector_code} value={c.connector_code}>
                        {c.connector_code}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="send-sms-modal__field">
                <span className="send-sms-modal__label">To</span>
                <input
                  type="text"
                  className="send-sms-modal__input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+63..."
                />
              </label>

              <label className="send-sms-modal__field">
                <span className="send-sms-modal__label">Message</span>
                <textarea
                  className="send-sms-modal__textarea"
                  rows={5}
                  maxLength={1600}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message..."
                />
                <span className="send-sms-modal__hint">
                  {body.length} / 1600
                </span>
              </label>
            </>
          )}
        </div>

        <div className="send-sms-modal__footer">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={sending || connectors.length === 0}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}