import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, ErrorBanner } from '@/components/primitives';
import {
  localDB,
  LocalConnector,
  SendConnectorMessageInput,
  SendRecommendationInput,
} from '@/services/local.db';
import './SendMessageModal.css';

interface SendMessageModalProps {
  debtorId: string;
  debtorName: string;
  presetConnectorCode?: string;
  /** "direct" (default) calls send_connector_message; "copilot" calls send_recommendation. */
  mode?: 'direct' | 'copilot';
  /** Copilot mode only. Populates the composer and carries the recommendation id. */
  prefill?: {
    recommendation_id?: string;
    subject?: string | null;
    body?: string;
    to?: string;
    connector_code?: string;
  };
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

// Mirrors gorka_shared::compliance::append_disclosure_idempotent.
// The Rust side is authoritative; this is a preview-only computation.
function finalBodyFor(rawDraft: string, disclosure: string | null): string {
  const d = (disclosure ?? '').trim();
  if (!d) return rawDraft;
  const lines = rawDraft.split('\n');
  const lastNonEmpty = [...lines]
    .reverse()
    .find((l) => l.trim() !== '');
  if (lastNonEmpty !== undefined && lastNonEmpty.trim() === d) {
    return rawDraft;
  }
  return `${rawDraft}\n${d}`;
}

export default function SendMessageModal({
  debtorId,
  debtorName,
  presetConnectorCode,
  mode = 'direct',
  prefill,
  onClose,
  onSent,
}: SendMessageModalProps) {
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [debtorEmail, setDebtorEmail] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(prefill?.subject ?? '');
  const [body, setBody] = useState(prefill?.body ?? '');
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rows, debtor, disclosureText] = await Promise.all([
          localDB.listLocalConnectors(),
          localDB.getDebtor(debtorId),
          localDB.getDisclosureText(),
        ]);
        const enabled = rows.filter(
          (r) =>
            r.status === 'ENABLED' &&
            (r.connector_code.endsWith('-sms') ||
              r.connector_code.endsWith('-email') ||
              r.connector_code.endsWith('-voice')),
        );
        setConnectors(enabled);
        const phone = debtor.phone ?? '';
        const email = debtor.email ?? '';
        setDebtorPhone(phone);
        setDebtorEmail(email);
        setDisclosure(disclosureText);

        let pick = enabled[0]?.connector_code ?? '';
        if (
          prefill?.connector_code &&
          enabled.some((c) => c.connector_code === prefill.connector_code)
        ) {
          pick = prefill.connector_code;
        } else if (
          presetConnectorCode &&
          enabled.some((c) => c.connector_code === presetConnectorCode)
        ) {
          pick = presetConnectorCode;
        }
        setSelectedCode(pick);
        setTo(prefill?.to ?? defaultRecipientFor(pick, phone, email));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [debtorId, presetConnectorCode, prefill]);

  const handleConnectorChange = (newCode: string) => {
    setSelectedCode(newCode);
    setTo(defaultRecipientFor(newCode, debtorPhone, debtorEmail));
    setSubject('');
  };

  const finalBody = finalBodyFor(body, disclosure);
  const showPreview = finalBody !== body;

  const handleSend = async () => {
    if (!selectedCode) {
      setError('No connector is enabled on this device.');
      return;
    }
    if (!to.trim()) {
      setError('Recipient is required.');
      return;
    }
    const isEmail = selectedCode.endsWith('-email');
    if (isEmail && !subject.trim()) {
      setError('Subject is required for email.');
      return;
    }
    if (!finalBody.trim()) {
      setError('Message body is required.');
      return;
    }

    setSending(true);
    setError('');
    try {
      if (mode === 'copilot') {
        if (!prefill?.recommendation_id) {
          throw new Error('Missing recommendation id.');
        }
        const copilotInput: SendRecommendationInput = {
          recommendationId: prefill.recommendation_id,
          connectorCode: selectedCode,
          to: to.trim(),
          subject: isEmail ? subject.trim() : null,
          draftBody: body,
        };
        await localDB.sendRecommendation(copilotInput);
      } else {
        const input: SendConnectorMessageInput = {
          connectorCode: selectedCode,
          debtorId,
          to: to.trim(),
          subject: isEmail ? subject.trim() : null,
          body: finalBody,
        };
        await localDB.sendConnectorMessage(input);
      }
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
  const isEmail = selectedCode.endsWith('-email');

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

              {isEmail && (
                <label className="send-message-modal__field">
                  <span className="send-message-modal__label">Subject</span>
                  <input
                    type="text"
                    className="send-message-modal__input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                  />
                </label>
              )}

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

              {showPreview && (
                <div className="send-message-modal__field">
                  <span className="send-message-modal__label">
                    Preview (what will be sent)
                  </span>
                  <pre className="send-message-modal__preview">
                    {finalBody}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        <div className="send-message-modal__footer">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
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