import type { CalendarEvent, Moment } from '../src/schema';

export function moment(date: string, time: string | null, timeZone: string | null = null): Moment {
  return { date, time, timeZone, timeZoneInferred: false };
}

export function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'Test event',
    start: moment('2026-10-01', '18:00', 'America/Chicago'),
    end: null,
    location: null,
    description: null,
    recurrence: null,
    timeGuessed: false,
    ...overrides,
  };
}
