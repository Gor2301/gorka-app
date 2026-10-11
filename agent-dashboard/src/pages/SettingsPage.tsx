// SettingsPage - Phase 9.5 About-only.
//
// Per the D.6 scope decision (Q4): Settings shows About, Data,
// Sync, and Security cards. Local password change is deferred.
//
// Slice 1 adds the Compliance card: the disclosure text that is
// appended to every outbound message on this device.

import { useEffect, useState } from 'react';
import { Card, Button, ErrorBanner } from '@/components/primitives';
import { localDB } from '@/services/local.db';
import './SettingsPage.css';

// Version is hardcoded for MVP. Replaced by a Rust command in a
// later slice when the app starts shipping releases.
const APP_VERSION = '0.0.0';

export default function SettingsPage() {
  const [disclosureText, setDisclosureText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const text = await localDB.getDisclosureText();
        setDisclosureText(text ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const trimmed = disclosureText.trim();
      await localDB.setDisclosureText(trimmed === '' ? null : trimmed);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <Card title="About">
        <dl className="settings-page__list">
          <div className="settings-page__row">
            <dt className="settings-page__label">App name</dt>
            <dd className="settings-page__value">GORKA Agent</dd>
          </div>
          <div className="settings-page__row">
            <dt className="settings-page__label">Version</dt>
            <dd className="settings-page__value">{APP_VERSION}</dd>
          </div>
          <div className="settings-page__row">
            <dt className="settings-page__label">Bundle id</dt>
            <dd className="settings-page__value">click.gorka.agent</dd>
          </div>
          <div className="settings-page__row">
            <dt className="settings-page__label">Product name</dt>
            <dd className="settings-page__value">GORKA-Agent-Dashboard</dd>
          </div>
        </dl>
      </Card>

      <Card title="Data">
        <dl className="settings-page__list">
          <div className="settings-page__row">
            <dt className="settings-page__label">Database file</dt>
            <dd className="settings-page__value">gorka-agent.db</dd>
          </div>
          <div className="settings-page__row">
            <dt className="settings-page__label">App data dir</dt>
            <dd className="settings-page__value">
              %APPDATA%\click.gorka.agent\
              <span className="settings-page__note">
                {' '}(resolves at runtime)
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Compliance">
        <p className="settings-page__paragraph">
          This text is appended to every outbound message on this
          device before it is sent. Leave blank to append nothing.
          The change applies to this device only.
        </p>
        {error && <ErrorBanner message={error} />}
        {saved && (
          <p className="settings-page__paragraph" style={{ color: '#16a34a' }}>
            Disclosure text saved.
          </p>
        )}
        <textarea
          value={disclosureText}
          onChange={(e) => {
            setDisclosureText(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="e.g. This message is from an authorized debt collector."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '8px',
            resize: 'vertical',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '12px',
          }}
        >
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Card>

      <Card title="Sync">
        <p className="settings-page__paragraph">
          Sync not yet enabled. The sync engine arrives in Phase 9.6.
          Your data stays on this device until then.
        </p>
      </Card>

      <Card title="Security">
        <p className="settings-page__paragraph">
          Local password change will arrive in a later phase.
        </p>
      </Card>
    </div>
  );
}