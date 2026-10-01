// PlanPage - the Agent's plan view (calendar).
//
// Three sources are overlaid on one FullCalendar:
//   - manual events   (stored, blue)  - create / edit / delete
//   - payments due    (derived, red)  - click navigates to debtor
//   - follow-ups due  (derived, amber)- click navigates to debtor
//
// Derived entries are never written to calendar_events. The
// stored table holds MANUAL rows only. See spec 11.7.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { Plus } from 'lucide-react';
import { Button, Card, ErrorBanner } from '@/components/primitives';
import {
  localDB,
  CalendarEvent,
  UpcomingPayment,
  UpcomingFollowup,
} from '@/services/local.db';
import CalendarEventEditModal from '@/components/CalendarEventEditModal';
import './PlanPage.css';

const VIEWS = [
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'timeGridWeek', label: 'Week' },
  { value: 'timeGridDay', label: 'Day' },
  { value: 'listWeek', label: 'List' },
];

const CARDS_WINDOW_DAYS = 30;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateToInputLocal(d: Date): string {
  return `${toYmd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(s: string): string {
  if (!s) return '-';
  const ymd = s.slice(0, 10);
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3) return ymd;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString();
}

function paymentBadgeClass(status: string): string {
  if (status === 'OVERDUE') return 'plan-page__badge--danger';
  if (status === 'PAID') return 'plan-page__badge--success';
  if (status === 'CANCELLED') return 'plan-page__badge--neutral';
  return 'plan-page__badge--accent';
}

function followupBadgeClass(status: string): string {
  if (status === 'COMPLETED') return 'plan-page__badge--success';
  if (status === 'CANCELLED') return 'plan-page__badge--neutral';
  if (status === 'IN_PROGRESS') return 'plan-page__badge--info';
  return 'plan-page__badge--warning';
}

interface ModalState {
  editingId: string | null;
  initial: CalendarEvent | null;
  defaultStart?: string;
  defaultEnd?: string;
  defaultAllDay?: boolean;
}

export default function PlanPage() {
  const navigate = useNavigate();
  const calendarRef = useRef<any>(null);

  const [view, setView] = useState('dayGridMonth');
  const [error, setError] = useState('');

  // Calendar-visible-range data.
  const [rangeEvents, setRangeEvents] = useState<CalendarEvent[]>([]);
  const [rangePayments, setRangePayments] = useState<UpcomingPayment[]>([]);
  const [rangeFollowups, setRangeFollowups] = useState<UpcomingFollowup[]>([]);

  // Cards data (fixed 30-day window).
  const [cardPayments, setCardPayments] = useState<UpcomingPayment[]>([]);
  const [cardFollowups, setCardFollowups] = useState<UpcomingFollowup[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  const [modalState, setModalState] = useState<ModalState | null>(null);

  // Load the two cards: today through the next 30 calendar days.
  useEffect(() => {
    (async () => {
      try {
        setCardsLoading(true);
        const start = toYmd(new Date());
        const end = toYmd(addDays(new Date(), CARDS_WINDOW_DAYS));
        const [payments, followups] = await Promise.all([
          localDB.getUpcomingPayments(start, end),
          localDB.getUpcomingFollowups(start, end),
        ]);
        setCardPayments(payments);
        setCardFollowups(followups);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setCardsLoading(false);
      }
    })();
  }, []);

  const loadCalendarRange = useCallback(async (start: string, end: string) => {
    try {
      const [events, payments, followups] = await Promise.all([
        localDB.getCalendarEvents(start, end),
        localDB.getUpcomingPayments(start, end),
        localDB.getUpcomingFollowups(start, end),
      ]);
      setRangeEvents(events);
      setRangePayments(payments);
      setRangeFollowups(followups);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleDatesSet = useCallback(
    (info: any) => {
      const start = String(info.startStr).slice(0, 10);
      const end = String(info.endStr).slice(0, 10);
      loadCalendarRange(start, end);
    },
    [loadCalendarRange],
  );

  const fcEvents = useMemo(() => {
    const items: any[] = [];

    for (const e of rangeEvents) {
      items.push({
        id: `manual-${e.id}`,
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        allDay: e.all_day,
        className: 'plan-page__fc-event--manual',
        extendedProps: { kind: 'manual', raw: e },
      });
    }

    for (const p of rangePayments) {
      items.push({
        id: `payment-${p.debt_id}`,
        title: `Payment: ${p.debtor_surname}, ${p.debtor_name}`,
        start: String(p.due_date).slice(0, 10),
        allDay: true,
        className: 'plan-page__fc-event--payment',
        extendedProps: { kind: 'payment', raw: p },
      });
    }

    for (const f of rangeFollowups) {
      items.push({
        id: `followup-${f.action_id}`,
        title: `${f.type}: ${f.debtor_surname}, ${f.debtor_name}`,
        start: String(f.due_date).slice(0, 10),
        allDay: true,
        className: 'plan-page__fc-event--followup',
        extendedProps: { kind: 'followup', raw: f },
      });
    }

    return items;
  }, [rangeEvents, rangePayments, rangeFollowups]);

  const changeView = (newView: string) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(newView);
    setView(newView);
  };

  const navigateCal = (dir: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (dir === 'prev') api.prev();
    else if (dir === 'next') api.next();
    else api.today();
  };

  const handleSelect = (selectInfo: any) => {
    const start: Date = selectInfo.start;
    const end: Date = selectInfo.end;
    const allDay: boolean = selectInfo.allDay;

    let defaultStart: string;
    let defaultEnd: string;

    if (allDay) {
      const ymd = toYmd(start);
      defaultStart = `${ymd}T00:00`;
      defaultEnd = `${ymd}T23:59`;
    } else {
      defaultStart = dateToInputLocal(start);
      defaultEnd = dateToInputLocal(end);
    }

    setModalState({
      editingId: null,
      initial: null,
      defaultStart,
      defaultEnd,
      defaultAllDay: allDay,
    });
  };

  const handleEventClick = (clickInfo: any) => {
    const kind = clickInfo.event.extendedProps.kind;
    const raw = clickInfo.event.extendedProps.raw;

    if (kind === 'manual') {
      setModalState({
        editingId: raw.id,
        initial: raw,
      });
    } else if (kind === 'payment') {
      navigate(`/debtors/${raw.debtor_id}`);
    } else if (kind === 'followup') {
      navigate(`/debtors/${raw.debtor_id}`);
    }
  };

  const openCreateFromNow = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const later = new Date(now);
    later.setHours(later.getHours() + 1);
    setModalState({
      editingId: null,
      initial: null,
      defaultStart: dateToInputLocal(now),
      defaultEnd: dateToInputLocal(later),
      defaultAllDay: false,
    });
  };

  const handleModalSaved = () => {
    setModalState(null);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const v = api.view;
    loadCalendarRange(
      v.activeStart.toISOString().slice(0, 10),
      v.activeEnd.toISOString().slice(0, 10),
    );
  };

  return (
    <div className="plan-page">
      <div className="plan-page__header">
        <p className="plan-page__subtitle">
          Manual events, upcoming payments, and follow-ups.
        </p>
        <Button variant="primary" onClick={openCreateFromNow}>
          <Plus size={16} />
          New Event
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="plan-page__toolbar">
        <div className="plan-page__views">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              className={`plan-page__view-btn${
                view === v.value ? ' plan-page__view-btn--active' : ''
              }`}
              onClick={() => changeView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="plan-page__nav">
          <button
            type="button"
            className="plan-page__nav-btn"
            onClick={() => navigateCal('prev')}
          >
            Prev
          </button>
          <button
            type="button"
            className="plan-page__nav-btn"
            onClick={() => navigateCal('today')}
          >
            Today
          </button>
          <button
            type="button"
            className="plan-page__nav-btn"
            onClick={() => navigateCal('next')}
          >
            Next
          </button>
        </div>
      </div>

      <div className="plan-page__calendar-wrap">
        <FullCalendar
          ref={calendarRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          headerToolbar={false}
          initialView="dayGridMonth"
          events={fcEvents}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          select={handleSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
        />
      </div>

      <div className="plan-page__cards">
        <Card>
          <div className="plan-page__card-header">
            <h2 className="plan-page__card-heading">Upcoming Payments</h2>
            <span className="plan-page__card-subtitle">Next 30 days</span>
          </div>
          {cardsLoading ? (
            <p className="plan-page__muted">Loading...</p>
          ) : cardPayments.length === 0 ? (
            <p className="plan-page__muted">
              No payments due in the next 30 days.
            </p>
          ) : (
            <ul className="plan-page__list">
              {cardPayments.map((p) => (
                <li key={p.debt_id} className="plan-page__row">
                  <button
                    type="button"
                    className="plan-page__row-link"
                    onClick={() => navigate(`/debtors/${p.debtor_id}`)}
                  >
                    {p.debtor_surname}, {p.debtor_name}
                  </button>
                  <span className="plan-page__amount">
                    {p.amount.toLocaleString()} {p.currency}
                  </span>
                  <span
                    className={`plan-page__badge ${paymentBadgeClass(p.status)}`}
                  >
                    {p.status}
                  </span>
                  <span className="plan-page__date">
                    {formatDate(p.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="plan-page__card-header">
            <h2 className="plan-page__card-heading">Upcoming Follow-ups</h2>
            <span className="plan-page__card-subtitle">Next 30 days</span>
          </div>
          {cardsLoading ? (
            <p className="plan-page__muted">Loading...</p>
          ) : cardFollowups.length === 0 ? (
            <p className="plan-page__muted">
              No follow-ups due in the next 30 days.
            </p>
          ) : (
            <ul className="plan-page__list">
              {cardFollowups.map((f) => (
                <li key={f.action_id} className="plan-page__row">
                  <button
                    type="button"
                    className="plan-page__row-link"
                    onClick={() => navigate(`/debtors/${f.debtor_id}`)}
                  >
                    {f.debtor_surname}, {f.debtor_name}
                  </button>
                  <span className="plan-page__badge plan-page__badge--accent">
                    {f.type}
                  </span>
                  <span
                    className={`plan-page__badge ${followupBadgeClass(f.status)}`}
                  >
                    {f.status}
                  </span>
                  <span className="plan-page__date">
                    {formatDate(f.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modalState && (
        <CalendarEventEditModal
          editingId={modalState.editingId}
          initial={modalState.initial}
          defaultStart={modalState.defaultStart}
          defaultEnd={modalState.defaultEnd}
          defaultAllDay={modalState.defaultAllDay}
          onSaved={handleModalSaved}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}