// gorka-shared::recommendation
//
// Slice 2 of the AI Copilot work.
// Authority: SLICE-2-MINI-SPEC v1.1 §5, §6.
//
// Canonical enums and the deterministic fallback.
// Pure functions. No database, no network, no clock.

/// Canonical priority vocabulary. Shared with the future AI schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Priority {
    Low,
    Normal,
    High,
}

/// Canonical tone vocabulary. Shared with the future AI schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tone {
    Friendly,
    Firm,
    Urgent,
    FinalNotice,
}

/// Canonical timing vocabulary. Shared with the future AI schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Timing {
    Within24Hours,
    Within3Days,
    Within7Days,
}

/// Canonical channel vocabulary. EMAIL only in the MVP.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Email,
}

/// A recommendation. Produced by the deterministic fallback now;
/// produced by the AI Strategy Engine in Slice 4.
#[derive(Debug, Clone, PartialEq)]
pub struct Recommendation {
    pub channel: Channel,
    pub priority: Priority,
    pub tone: Tone,
    pub timing: Timing,
}

/// The deterministic fallback (Part II §II.9, minus the promise branch).
///
/// Boundaries are strict:
///   - URGENT requires days_overdue > 60 AND response_rate < 0.2.
///   - FIRM requires days_overdue > 30 (and not the URGENT case).
///   - FRIENDLY otherwise.
///
/// timing is always Within3Days in this slice. Fixed, not derived.
pub fn fallback(days_overdue: i64, response_rate: f64) -> Recommendation {
    let (priority, tone) = if days_overdue > 60 && response_rate < 0.2 {
        (Priority::High, Tone::Urgent)
    } else if days_overdue > 30 {
        (Priority::Normal, Tone::Firm)
    } else {
        (Priority::Normal, Tone::Friendly)
    };

    Recommendation {
        channel: Channel::Email,
        priority,
        tone,
        timing: Timing::Within3Days,
    }
}