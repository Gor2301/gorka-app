import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { calendarService } from '../services/calendar.service';
import { Plus, X, Trash2, RefreshCw } from 'lucide-react';
import type { CalendarEvent } from '../services/calendar.service';

const Calendar: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dayGridMonth');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    allDay: false,
    eventType: 'MANUAL' as 'PAYMENT_DUE' | 'FOLLOW_UP' | 'MANUAL',
    debtorId: ''
  });
  const calendarRef = useRef<any>(null);

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
      
      const response = await calendarService.getEvents(
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (response && response.success) {
        const formattedEvents = (response.data || []).map((event: CalendarEvent) => ({
          id: event.id,
          title: event.title,
          start: event.startDate,
          end: event.endDate,
          allDay: event.allDay,
          extendedProps: {
            description: event.description,
            eventType: event.eventType,
            debtorId: event.debtorId
          }
        }));
        setEvents(formattedEvents);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (selectInfo: any) => {
    setFormData({
      title: '',
      description: '',
      startDate: selectInfo.startStr,
      endDate: selectInfo.endStr,
      allDay: selectInfo.allDay,
      eventType: 'MANUAL',
      debtorId: ''
    });
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    setEditingEvent({
      id: event.id,
      title: event.title,
      startDate: event.startStr,
      endDate: event.endStr,
      allDay: event.allDay,
      extendedProps: event.extendedProps
    });
    setFormData({
      title: event.title,
      description: event.extendedProps.description || '',
      startDate: event.startStr,
      endDate: event.endStr,
      allDay: event.allDay,
      eventType: event.extendedProps.eventType || 'MANUAL',
      debtorId: event.extendedProps.debtorId || ''
    });
    setShowModal(true);
  };

  const handleSaveEvent = async () => {
    try {
      const eventData = {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        allDay: formData.allDay,
        eventType: formData.eventType,
        debtorId: formData.debtorId || undefined
      };

      if (editingEvent) {
        await calendarService.updateEvent(editingEvent.id, eventData);
      } else {
        await calendarService.createEvent(eventData);
      }
      
      setShowModal(false);
      setEditingEvent(null);
      await fetchEvents();
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Failed to save event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await calendarService.deleteEvent(editingEvent.id);
      setShowModal(false);
      setEditingEvent(null);
      await fetchEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event');
    }
  };

  const handleGenerateEvents = async () => {
    if (!confirm('Generate events from debtor data?')) return;
    try {
      await calendarService.generateEvents();
      await fetchEvents();
      alert('Events generated successfully!');
    } catch (err) {
      console.error('Error generating events:', err);
      alert('Failed to generate events');
    }
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
  };

  const handleDateNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      if (direction === 'prev') calendarApi.prev();
      else if (direction === 'next') calendarApi.next();
      else calendarApi.today();
      
      const newDate = calendarApi.getDate();
      setCurrentDate(newDate);
    }
  };

  const eventColorMap: Record<string, string> = {
    PAYMENT_DUE: '#ef4444',
    FOLLOW_UP: '#f59e0b',
    MANUAL: '#3b82f6'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">Manage your events and deadlines</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateEvents}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Events
          </button>
          <button
            onClick={() => {
              setEditingEvent(null);
              setFormData({
                title: '',
                description: '',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 3600000).toISOString(),
                allDay: false,
                eventType: 'MANUAL',
                debtorId: ''
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleViewChange('dayGridMonth')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === 'dayGridMonth' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => handleViewChange('timeGridWeek')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === 'timeGridWeek' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => handleViewChange('timeGridDay')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === 'timeGridDay' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => handleViewChange('listWeek')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              view === 'listWeek' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            List
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleDateNavigate('prev')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => handleDateNavigate('today')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => handleDateNavigate('next')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <FullCalendar
          ref={calendarRef}
          // @ts-ignore - FullCalendar plugin type compatibility
plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          headerToolbar={false}
          initialView={view}
          events={events}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          height="auto"
          eventColor="#3b82f6"
          eventDidMount={(info) => {
            const eventType = info.event.extendedProps.eventType;
            if (eventType && eventColorMap[eventType]) {
              info.el.style.backgroundColor = eventColorMap[eventType];
              info.el.style.borderColor = eventColorMap[eventType];
            }
          }}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Event description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate.slice(0, 16)}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate.slice(0, 16)}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.allDay}
                  onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700">All day event</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MANUAL">Manual</option>
                  <option value="PAYMENT_DUE">Payment Due</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 flex gap-3">
              {editingEvent && (
                <button
                  onClick={handleDeleteEvent}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingEvent ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;