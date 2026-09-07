import { api } from './api.service';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  eventType: 'PAYMENT_DUE' | 'FOLLOW_UP' | 'MANUAL';
  debtorId?: string;
  debtor?: { name: string; email: string };
  sourceDate?: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const calendarService = {
  async getEvents(startDate?: string, endDate?: string) {
    try {
      let url = '/calendar/events';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await api.get(url);
      return response;
    } catch (error: any) {
      console.error('Calendar service error:', error);
      throw error;
    }
  },

  async createEvent(data: Partial<CalendarEvent>) {
    try {
      const response = await api.post('/calendar/events', data);
      return response;
    } catch (error: any) {
      console.error('Calendar service error:', error);
      throw error;
    }
  },

  async updateEvent(id: string, data: Partial<CalendarEvent>) {
    try {
      const response = await api.put(`/calendar/events/${id}`, data);
      return response;
    } catch (error: any) {
      console.error('Calendar service error:', error);
      throw error;
    }
  },

  async deleteEvent(id: string) {
    try {
      const response = await api.delete(`/calendar/events/${id}`);
      return response;
    } catch (error: any) {
      console.error('Calendar service error:', error);
      throw error;
    }
  },

  async generateEvents() {
    try {
      const response = await api.post('/calendar/generate');
      return response;
    } catch (error: any) {
      console.error('Calendar service error:', error);
      throw error;
    }
  }
};