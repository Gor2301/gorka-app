import type { ClaimFlagView } from '@/services/local.db';
import './CopilotFlagList.css';

interface CopilotFlagListProps {
  flags: ClaimFlagView[];
  /** When true, the last validation call failed and these flags may be stale. */
  mayBeStale?: boolean;
}

function labelForClaimType(t: ClaimFlagView['claim_type']): string {
  switch (t) {
    case 'DollarAmount':
      return 'Amount';
    case 'CalendarDate':
      return 'Date';
    case 'InvoiceRef':
      return 'Reference';
    case 'PriorPromisePayment':
      return 'Prior promise';
    case 'LegalOrCreditConsequence':
      return 'Legal / credit';
  }
}

function classForVerification(kind: ClaimFlagView['verification_kind']): string {
  switch (kind) {
    case 'Verified':
      return 'copilot-flag copilot-flag--verified';
    case 'Mismatch':
      return 'copilot-flag copilot-flag--mismatch';
    case 'Unverifiable':
      return 'copilot-flag copilot-flag--unverifiable';
  }
}

function describeVerification(flag: ClaimFlagView): string {
  switch (flag.verification_kind) {
    case 'Verified':
      return flag.db_value
        ? `Verified against record: ${flag.db_value}`
        : 'Verified against record.';
    case 'Mismatch':
      return flag.db_value
        ? `Does not match record: ${flag.db_value}`
        : 'Does not match any record.';
    case 'Unverifiable':
      return 'No matching record on this device.';
  }
}

export default function CopilotFlagList({
  flags,
  mayBeStale = false,
}: CopilotFlagListProps) {
  if (flags.length === 0 && !mayBeStale) {
    return (
      <p className="copilot-flag-list__empty">No claims detected.</p>
    );
  }

  if (flags.length === 0 && mayBeStale) {
    return null;
  }

  return (
    <div className="copilot-flag-list">
      {mayBeStale && (
        <p className="copilot-flag-list__stale">
          Flags may be stale &mdash; the last validation attempt failed.
        </p>
      )}
      {flags.map((flag, i) => (
        <div
          key={`${flag.claim_type}-${flag.source}-${flag.span_start}-${i}`}
          className={classForVerification(flag.verification_kind)}
        >
          <div className="copilot-flag__header">
            <span className="copilot-flag__type">
              {labelForClaimType(flag.claim_type)}
            </span>
            <span className="copilot-flag__source">
              {flag.source === 'Subject' ? 'subject' : 'body'}
            </span>
          </div>
          <div className="copilot-flag__text">
            &ldquo;{flag.matched_text}&rdquo;
          </div>
          <div className="copilot-flag__explanation">
            {describeVerification(flag)}
          </div>
        </div>
      ))}
    </div>
  );
}