import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Button, ErrorBanner, Spinner } from '@/components/primitives';
import {
  localDB,
  RecommendationView,
  CopilotProviderRow,
  ClaimFlagView,
} from '@/services/local.db';
import CopilotFlagList from '@/components/CopilotFlagList';
import SendMessageModal from '@/components/SendMessageModal';
import './CopilotPanel.css';

const REGEN_LIMIT = 3;
const FLAG_DEBOUNCE_MS = 300;

function channelFilterFor(
  channel: RecommendationView['channel'],
): 'email' | 'sms' | 'voice' {
  switch (channel) {
    case 'Email':
      return 'email';
    case 'Sms':
      return 'sms';
    case 'Voice':
      return 'voice';
  }
}

interface CopilotPanelProps {
  debtorId: string;
  debtorName: string;
  /** Increment to force a re-fetch of the latest recommendation. */
  refreshKey?: number;
  /** Called after a successful send from the Copilot composer. */
  onSendComplete?: () => void;
}

export default function CopilotPanel({
  debtorId,
  debtorName,
  refreshKey = 0,
  onSendComplete,
}: CopilotPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const [providers, setProviders] = useState<CopilotProviderRow[] | null>(null);
  const [rec, setRec] = useState<RecommendationView | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const [flags, setFlags] = useState<ClaimFlagView[]>([]);
  const [flagsStale, setFlagsStale] = useState(false);
  const [flagsError, setFlagsError] = useState('');
  const latestFlagRequestRef = useRef(0);
  const flagDebounceRef = useRef<number | null>(null);

  const [regenCount, setRegenCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [composer, setComposer] = useState<{
    recommendationId: string;
    subject: string | null;
    body: string;
  } | null>(null);

  // --- Load providers + latest recommendation on expand or refresh ---
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    (async () => {
      setInitializing(true);
      setError('');
      try {
        const [provs, recs] = await Promise.all([
          localDB.listCopilotProviders(),
          localDB.listRecommendationsForDebtor(debtorId),
        ]);
        if (cancelled) return;
        setProviders(provs);
        const latest = recs.length > 0 ? recs[0] : null;
        setRec(latest);
        setDraftSubject(latest?.draft_subject ?? '');
        setDraftBody(latest?.draft_body ?? '');
        setFlags([]);
        setFlagsStale(false);
        setFlagsError('');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, debtorId, refreshKey]);

  // --- Live flag validation: debounce + stale-response guard ---
  const runFlagValidation = useCallback(
    async (subject: string, body: string) => {
      const requestId = ++latestFlagRequestRef.current;
      try {
        const result = await localDB.validateDraftForCopilot(
          debtorId,
          subject || null,
          body,
        );
        if (requestId !== latestFlagRequestRef.current) return;
        setFlags(result);
        setFlagsStale(false);
        setFlagsError('');
      } catch (err) {
        if (requestId !== latestFlagRequestRef.current) return;
        setFlagsStale(true);
        setFlagsError(err instanceof Error ? err.message : String(err));
      }
    },
    [debtorId],
  );

  useEffect(() => {
    if (!editing) return;
    if (flagDebounceRef.current !== null) {
      window.clearTimeout(flagDebounceRef.current);
    }
    flagDebounceRef.current = window.setTimeout(() => {
      flagDebounceRef.current = null;
      runFlagValidation(draftSubject, draftBody);
    }, FLAG_DEBOUNCE_MS);
    return () => {
      if (flagDebounceRef.current !== null) {
        window.clearTimeout(flagDebounceRef.current);
        flagDebounceRef.current = null;
      }
      // Invalidate in-flight responses on unmount or edit-mode change.
      latestFlagRequestRef.current++;
    };
  }, [editing, draftSubject, draftBody, runFlagValidation]);

  // --- Handlers ---
  const refresh = useCallback(async (): Promise<RecommendationView | null> => {
    try {
      const recs = await localDB.listRecommendationsForDebtor(debtorId);
      const latest = recs.length > 0 ? recs[0] : null;
      setRec(latest);
      if (latest) {
        setDraftSubject(latest.draft_subject ?? '');
        setDraftBody(latest.draft_body);
      }
      return latest;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [debtorId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const row = await localDB.analyzeDebtor(debtorId);
      setRec(row);
      setDraftSubject(row.draft_subject ?? '');
      setDraftBody(row.draft_body);
      setFlags([]);
      setFlagsStale(false);
      setFlagsError('');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenCount >= REGEN_LIMIT) return;
    setAnalyzing(true);
    setError('');
    try {
      const row = await localDB.analyzeDebtor(debtorId);
      setRec(row);
      setDraftSubject(row.draft_subject ?? '');
      setDraftBody(row.draft_body);
      setFlags([]);
      setFlagsStale(false);
      setFlagsError('');
      setRegenCount((n) => n + 1);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReject = async () => {
    if (!rec) return;
    setActionLoading(true);
    setError('');
    try {
      await localDB.decideRecommendation(rec.id, 'reject');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!rec) return;
    setActionLoading(true);
    setError('');
    try {
      await localDB.decideRecommendation(rec.id, 'accept');
      // Transition locally. Do not refresh() here: refresh() would
      // overwrite draftBody with the DB value (empty for a fallback
      // recommendation), losing the user's edit before the composer
      // opens. The panel refreshes after the send completes.
      setRec({ ...rec, status: 'ACCEPTED' });
      setComposer({
        recommendationId: rec.id,
        subject: draftSubject || null,
        body: draftBody,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenComposer = () => {
    if (!rec) return;
    setComposer({
      recommendationId: rec.id,
      subject: draftSubject || null,
      body: draftBody,
    });
  };

  const handleConfirm = async (attemptId: string, delivered: boolean) => {
    setConfirming(true);
    setError('');
    try {
      await localDB.confirmUncertainAttempt(attemptId, delivered);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  };

  // --- Header ---
  const header = (
    <button
      type="button"
      className="copilot-panel__header"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
    >
      <span className="copilot-panel__header-title">
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>Copilot</span>
      </span>
      <span className="copilot-panel__header-subtitle">
        AI drafts a message for {debtorName}. Nothing is sent without your
        approval.
      </span>
    </button>
  );

  if (!expanded) {
    return <section className="copilot-panel">{header}</section>;
  }

  // --- Expanded render ---
  let body: ReactNode;

  if (initializing) {
    body = (
      <div className="copilot-panel__center">
        <Spinner />
      </div>
    );
  } else if (providers !== null && providers.length === 0) {
    body = (
      <p className="copilot-panel__muted">
        Copilot is not enabled. Ask your administrator.
      </p>
    );
  } else if (rec === null) {
    body = (
      <div className="copilot-panel__pre-run">
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          loading={analyzing}
        >
          Analyze debtor
        </Button>
        <p className="copilot-panel__hint">
          Recommendations expire 72 hours after creation.
        </p>
      </div>
    );
  } else {
    body = renderRecommendation(rec);
  }

  return (
    <>
      <section className="copilot-panel">
        {header}
        <div className="copilot-panel__body">
          {error && <ErrorBanner message={error} />}
          {body}
        </div>
      </section>
      {composer && rec && (
        <SendMessageModal
          debtorId={debtorId}
          debtorName={debtorName}
          mode="copilot"
          prefill={{
            recommendation_id: composer.recommendationId,
            subject: composer.subject,
            body: composer.body,
          }}
          channelFilter={channelFilterFor(rec.channel)}
          onClose={() => setComposer(null)}
          onSent={async () => {
            setComposer(null);
            await refresh();
            onSendComplete?.();
          }}
        />
      )}
    </>
  );

  // --- Render helpers (hoisted) ---

  function renderRecommendation(r: RecommendationView): ReactNode {
    const attemptId = r.uncertain_attempt_id;

    if (attemptId) {
      return (
        <div className="copilot-panel__section">
          <div className="copilot-panel__uncertain">
            <p className="copilot-panel__uncertain-title">
              The provider did not confirm delivery.
            </p>
            <p className="copilot-panel__uncertain-text">
              The message may or may not have been sent.
            </p>
            <div className="copilot-panel__actions">
              <Button
                size="sm"
                onClick={() => handleConfirm(attemptId, true)}
                disabled={confirming}
                loading={confirming}
              >
                Confirm delivered
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleConfirm(attemptId, false)}
                disabled={confirming}
              >
                Confirm not delivered
              </Button>
            </div>
          </div>
        </div>
      );
    }

    switch (r.status) {
      case 'PENDING':
        return renderPending(r);
      case 'ACCEPTED':
        return (
          <div className="copilot-panel__section">
            <p className="copilot-panel__status-ok">
              Accepted. Edit and send from the composer, or let it expire.
            </p>
            <div className="copilot-panel__actions">
              <Button onClick={handleOpenComposer}>Open composer</Button>
            </div>
          </div>
        );
      case 'SENT':
        return (
          <div className="copilot-panel__section">
            <p className="copilot-panel__status-ok">
              Sent via {r.delivery_connector_code ?? 'an unknown connector'} at {formatTimestamp(r.decided_at ?? r.created_at)}.
            </p>
            <div className="copilot-panel__actions">
              <Button onClick={handleAnalyze} loading={analyzing}>
                Analyze debtor
              </Button>
            </div>
          </div>
        );
      case 'EXPIRED':
        return (
          <div className="copilot-panel__section">
            <p className="copilot-panel__muted">
              This recommendation has expired.
            </p>
            <div className="copilot-panel__actions">
              <Button onClick={handleAnalyze} loading={analyzing}>
                Analyze debtor
              </Button>
            </div>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="copilot-panel__section">
            <p className="copilot-panel__muted">
              This recommendation was rejected.
            </p>
            <div className="copilot-panel__actions">
              <Button onClick={handleAnalyze} loading={analyzing}>
                Analyze debtor
              </Button>
            </div>
          </div>
        );
      case 'SEND_UNCERTAIN':
        return (
          <div className="copilot-panel__section">
            <p className="copilot-panel__uncertain-text">
              The provider did not confirm delivery.
            </p>
          </div>
        );
    }
  }

  function renderPending(r: RecommendationView): ReactNode {
    return (
      <div className="copilot-panel__section">
        <div className="copilot-panel__badges">
          <span
            className={
              r.source === 'AI'
                ? 'copilot-panel__badge copilot-panel__badge--ai'
                : 'copilot-panel__badge copilot-panel__badge--fallback'
            }
          >
            {r.source === 'AI' ? 'AI' : 'Fallback — AI unavailable'}
          </span>
        </div>

        <dl className="copilot-panel__recommendation">
          <div>
            <dt>Channel</dt>
            <dd>{r.channel}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{r.priority}</dd>
          </div>
          <div>
            <dt>Tone</dt>
            <dd>{r.tone}</dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>{r.timing}</dd>
          </div>
        </dl>

        {r.rationale && (
          <p className="copilot-panel__rationale">
            <span className="copilot-panel__rationale-label">
              AI explanation — unverified:
            </span>{' '}
            {r.rationale}
          </p>
        )}

        <div className="copilot-panel__draft">
          <div className="copilot-panel__draft-header">
            <span className="copilot-panel__field-label">Draft</span>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {editing ? (
            <>
              <label className="copilot-panel__field">
                <span className="copilot-panel__field-label">Subject</span>
                <input
                  className="copilot-panel__input"
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                />
              </label>
              <label className="copilot-panel__field">
                <span className="copilot-panel__field-label">Body</span>
                <textarea
                  className="copilot-panel__textarea"
                  rows={6}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                />
              </label>
              <div className="copilot-panel__draft-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setDraftSubject(r.draft_subject ?? '');
                    setDraftBody(r.draft_body);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setEditing(false)}>
                  Save edit
                </Button>
              </div>
            </>
          ) : (
            <>
              {draftSubject && (
                <div className="copilot-panel__draft-subject">
                  <strong>Subject:</strong> {draftSubject}
                </div>
              )}
              <pre className="copilot-panel__draft-body">{draftBody}</pre>
            </>
          )}
        </div>

        {flagsError && <ErrorBanner message={flagsError} />}
        <CopilotFlagList flags={flags} mayBeStale={flagsStale} />

        <div className="copilot-panel__actions">
          <Button onClick={handleAccept} loading={actionLoading}>
            Accept and Review
          </Button>
          <Button
            variant="ghost"
            onClick={handleReject}
            disabled={actionLoading}
          >
            Reject
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenCount >= REGEN_LIMIT || analyzing}
            loading={analyzing}
            title={
              regenCount >= REGEN_LIMIT
                ? 'Regeneration limit reached for this session.'
                : 'Regenerate'
            }
          >
            <RefreshCw size={14} /> Regenerate
          </Button>
        </div>

        <p className="copilot-panel__hint">
          Expires {expiryLabel(r.created_at)}.
        </p>
      </div>
    );
  }
}

function formatTimestamp(s: string | null | undefined): string {
  if (!s) return 'an unknown time';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString();
  } catch {
    return s;
  }
}

function expiryLabel(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    d.setHours(d.getHours() + 72);
    return d.toLocaleString();
  } catch {
    return '72 hours after creation';
  }
}