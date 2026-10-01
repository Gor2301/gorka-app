// CalendarEventEditModal - create/edit a MANUAL calendar event.
//
// Stored events in the Agent MVP are always event_type = 'MANUAL'.
// Payments and follow-ups are derived views, never stored, and
// never pass through this modal.
//
// Mode is inferred: editingId + initial present = edit. Otherwise
// create. When opened from an empty day click, defaultStart and
// defaultEnd pre-fill the date/time fields.

import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Label,
  ErrorBanner,
  Spinner,
} from './primitives';
import { localDB, Debtor, CalendarEvent } from '@/services/local.db';
import './CalendarEventEditModal.css';

export interface CalendarEventEditModalProps {
  /** Null for create, the event id for edit. */
  editingId: string | null;
  /** The event being edited, or null for create. */
  initial: CalendarEvent | null;
  /** Optional pre-fill for the create flow. Ignored when editing. */
  defaultStart?: string;
  defaultEnd?: string;
  defaultAllDay?: boolean;
  onSaved: () => void;
  onClose: () => void;
}

// Convert an ISO-ish timestamp into the value format
// <input type="datetime-local"> expects: YYYY-MM-DDTHH:mm.
function toLocalInput(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 16);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export default function CalendarEventEditModal({
  editingId,
  initial,
  defaultStart,
  defaultEnd,
  defaultAllDay,
  onSaved,
  onClose,
}: CalendarEventEditModalProps) {
  const isEdit = editingId !== null && initial !== null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startDate, setStartDate] = useState(
    initial ? toLocalInput(initial.start_date) : toLocalInput(defaultStart ?? ''),
  );
  const [endDate, setEndDate] = useState(
    initial ? toLocalInput(initial.end_date) : toLocalInput(defaultEnd ?? ''),
  );
  const [allDay, setAllDay] = useState(initial?.all_day ?? defaultAllDay ?? false);

  const [linkedDebtor, setLinkedDebtor] = useState<Debtor | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Debtor[]>([]);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // On edit, resolve the linked debtor for display in the picker.
  useEffect(() => {
    if (!initial?.debtor_id) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await localDB.getDebtor(initial.debtor_id!);
        if (!cancelled) setLinkedDebtor(d);
      } catch {
        // Debtor may have been removed. Leave the picker empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial?.debtor_id]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      setFormError('');
      const rows = await localDB.searchDebtors(q);
      setSearchResults(rows);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const pickDebtor = (d: Debtor) => {
    setLinkedDebtor(d);
    setSearchResults([]);
    setSearchQuery('');
  };

  const clearDebtor = () => {
    setLinkedDebtor(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!startDate) {
      setFormError('Start date is required');
      return;
    }
    if (!endDate) {
      setFormError('End date is required');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      const input = {
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        all_day: allDay,
        debtor_id: linkedDebtor?.id ?? null,
      };

      if (isEdit) {
        await localDB.updateCalendarEvent(editingId!, input);
      } else {
        await localDB.insertCalendarEvent(input);
      }

      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!window.confirm(`Delete event "${title}"?`)) return;
    try {
      setSaving(true);
      setFormError('');
      await localDB.deleteCalendarEvent(editingId!);
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Event' : 'New Event'}
      closeOnOverlayClick={false}
      footer={
        <>
          {isEdit && (
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      {formError && (
        <div className="calendar-event-modal__error">
          <ErrorBanner message={formError} />
        </div>
      )}

      <div className="calendar-event-modal__fields">
        <div>
          <Label>Title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
          />
        </div>

        <div>
          <Label>Description</Label>
          <textarea
            className="calendar-event-modal__textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="calendar-event-modal__row">
          <div>
            <Label>Start</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>End</Label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <label className="calendar-event-modal__checkbox-row">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          <span>All day event</span>
        </label>

        <div>
          <Label>Link to debtor (optional)</Label>
          {linkedDebtor ? (
            <div className="calendar-event-modal__picked">
              <span>
                {linkedDebtor.surname}, {linkedDebtor.name}
              </span>
              <button
                type="button"
                className="calendar-event-modal__clear"
                onClick={clearDebtor}
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="calendar-event-modal__picker">
              <Input
                placeholder="Search name, surname, email, phone..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searching && (
                <div className="calendar-event-modal__searching">
                  <Spinner size={20} />
                </div>
              )}
              {searchResults.length > 0 && (
                <ul className="calendar-event-modal__results">
                  {searchResults.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="calendar-event-modal__result"
                        onClick={() => pickDebtor(d)}
                      >
                        <span className="calendar-event-modal__result-name">
                          {d.surname}, {d.name}
                        </span>
                        {d.email && (
                          <span className="calendar-event-modal__result-meta">
                            {d.email}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}