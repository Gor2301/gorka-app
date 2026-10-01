// SettingsPage - Phase 9.5 About-only.
//
// Per the D.6 scope decision (Q4): Settings shows About, Data,
// Sync, and Security cards. Local password change is deferred.
//
// No new Rust command. The version string is hardcoded per the
// D.6 answer: D.6.2 is authorized for exactly one new Rust
// command (get_all_actions), and a static string does not
// justify a second one.

import { Card } from '@/components/primitives';
import './SettingsPage.css';

// Version is hardcoded for MVP. Replaced by a Rust command in a
// later slice when the app starts shipping releases.
const APP_VERSION = '0.0.0';

export default function SettingsPage() {
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
            <dd className="settings-page__value">com.gorka.agent</dd>
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
              %APPDATA%\com.gorka.agent\
              <span className="settings-page__note">
                {' '}(resolves at runtime)
              </span>
            </dd>
          </div>
        </dl>
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