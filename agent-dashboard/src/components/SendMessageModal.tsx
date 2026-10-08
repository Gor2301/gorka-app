import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, ErrorBanner } from '@/components/primitives';
import {
  localDB,
  LocalConnector,
  SendConnectorMessageInput,
} from '@/services/local.db';
import './SendMessageModal.css';

interface SendMessageModalProps {
  debtorId: string;
  debtorName: string;
  presetConnectorCode?: string;
  onClose: () => void;
  onSent: () => void;
}

function defaultRecipientFor(
  connectorCode: string,
  phone: string,
  email: string,
): string {
  if (connectorCode.endsWith('-sms')) return phone;
  if (connectorCode.endsWith('-email')) return email;
  return '';
}

function recipientLabelFor(connectorCode: string): string {
  if (connectorCode.endsWith('-sms')) return 'Phone';
  if (connectorCode.endsWith('-email')) return 'Email';
  return 'Recipient';
}

function recipientPlaceholderFor(connectorCode: string): string {
  if (connectorCode.endsWith('-sms')) return '+63...';
  if (connectorCode.endsWith('-email')) return 'name@example.com';
  return '';
}

export default function SendMessageModal({
  debtorId,
  debtorName,
  presetConnectorCode,
  onClose,
  onSent,
}: SendMessageModalProps) {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [debtorEmail, setDebtorEmail] = useState('');
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rows, debtor] = await Promise.all([
          localDB.listLocalConnectors(),
          localDB.getDebtor(debtorId),
        ]);
        const enabled = rows.filter((r) => r.status === 'ENABLED');
        setConnectors(enabled);
        const phone = debtor.phone ?? '';
        const email = debtor.email ?? '';
        setDebtorPhone(phone);
        setDebtorEmail(email);

        let pick = enabled[0]?.connector_code ?? '';
        if (
          presetConnectorCode &&
          enabled.some((c) => c.connector_code === presetConnectorCode)
        ) {
          pick = presetConnectorCode;
        }
        setSelectedCode(pick);
        setTo(defaultRecipientFor(pick, phone, email));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [debtorId, presetConnectorCode]);

  const handleConnectorChange = (newCode: string) => {
    setSelectedCode(newCode);
    setTo(defaultRecipientFor(newCode, debtorPhone, debtorEmail));
  };

  const handleSend = async () => {
    if (!selectedCode) {
      setError('No connector is enabled on this device.');
      return;
    }
    if (!to.trim()) {
      setError('Recipient is required.');
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

  const recipientLabel = selectedCode
    ? recipientLabelFor(selectedCode)
    : 'Recipient';
  const recipientPlaceholder = selectedCode
    ? recipientPlaceholderFor(selectedCode)
    : '';

  return (
    <div className="send-message-modal__overlay">
      <div className="send-message-modal">
        <div className="send-message-modal__header">
          <h2 className="send-message-modal__title">Send to {debtorName}</h2>
          <button
            type="button"
            className="send-message-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="send-message-modal__body">
          {error && <ErrorBanner message={error} />}

          {connectors.length === 0 ? (
            <p className="send-message-modal__muted">
              No connector is enabled on this device. Ask your
              administrator to enable one.
            </p>
          ) : (
            <>
              {connectors.length > 1 && (
                <label className="send-message-modal__field">
                  <span className="send-message-modal__label">Send via</span>
                  <select
                    className="send-message-modal__select"
                    value={selectedCode}
                    onChange={(e) => handleConnectorChange(e.target.value)}
                  >
                    {connectors.map((c) => (
                      <option key={c.connector_code} value={c.connector_code}>
                        {c.connector_code}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="send-message-modal__field">
                <span className="send-message-modal__label">
                  {recipientLabel}
                </span>
                <input
                  type="text"
                  className="send-message-modal__input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={recipientPlaceholder}
                />
              </label>

              <label className="send-message-modal__field">
                <span className="send-message-modal__label">Message</span>
                <textarea
                  className="send-message-modal__textarea"
                  rows={5}
                  maxLength={1600}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message..."
                />
                <span className="send-message-modal__hint">
                  {body.length} / 1600
                </span>
              </label>
            </>
          )}
        </div>

        <div className="send-message-modal__footer">
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