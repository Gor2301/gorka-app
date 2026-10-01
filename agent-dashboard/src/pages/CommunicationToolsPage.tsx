// CommunicationToolsPage - Phase 9.5 placeholder.
//
// Per AGENT-APP-SPEC.md v1.3 section 11.8 and the D.6 scope
// decision (Q1): this page reads nothing, creates no table, and
// triggers no migration. The local_connectors table belongs to
// Phase 9.6. The mechanism by which the admin's configuration
// reaches the agent is out of scope for Phase 9.5.
//
// The empty state text is the exact sentence from spec 11.8.
// Do not paraphrase. Do not add a subtitle, a link, or a support
// email.

import { MessageSquare } from 'lucide-react';
import { Card } from '@/components/primitives';
import './CommunicationToolsPage.css';

export default function CommunicationToolsPage() {
  return (
    <div className="communication-tools-page">
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
    </div>
  );
}