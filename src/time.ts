import type { CalendarEvent } from './schema';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ResolvedTimes =
  | { kind: 'timed'; start: Date; end: Date; startTimeZone: string }
  | { kind: 'allDay'; startDate: string; endDateExclusive: string };

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) of `timeZone` from UTC at the given instant.
function offsetAt(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function numbers(s: string, sep: string): number[] {
  return s.split(sep).map((part) => Number(part));
}

/** Converts a wall-clock date/time in an IANA timezone to a UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y = 0, mo = 1, d = 1] = numbers(date, '-');
  const [h = 0, mi = 0] = numbers(time, ':');
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = wallAsUtc - offsetAt(timeZone, wallAsUtc);
  // Re-check the offset at the guessed instant to handle DST transitions.
  const offset = offsetAt(timeZone, firstGuess);
  return new Date(wallAsUtc - offset);
}

export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = numbers(date, '-');
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Turns the LLM's page-local times into concrete instants. Start and end each
 * carry their own timezone, so a 6pm CT → 9pm ET flight becomes 2 hours long.
 */
export function resolveTimes(event: CalendarEvent, fallbackTimeZone: string): ResolvedTimes {
  const { start, end } = event;

  if (!start.time) {
    const lastDate = end && end.date >= start.date ? end.date : start.date;
    return { kind: 'allDay', startDate: start.date, endDateExclusive: addDays(lastDate, 1) };
  }

  const startTimeZone = isValidTimeZone(start.timeZone) ? start.timeZone : fallbackTimeZone;
  const startUtc = zonedToUtc(start.date, start.time, startTimeZone);

  if (!end?.time) {
    return { kind: 'timed', start: startUtc, end: new Date(startUtc.getTime() + HOUR_MS), startTimeZone };
  }

  // An end without its own timezone shares the start's.
  const endTimeZone = isValidTimeZone(end.timeZone) ? end.timeZone : startTimeZone;
  let endUtc = zonedToUtc(end.date, end.time, endTimeZone);

  // "10pm–1am" is often returned with the same date for both ends.
  if (endUtc <= startUtc && end.date === start.date) {
    endUtc = new Date(endUtc.getTime() + DAY_MS);
  }
  if (endUtc <= startUtc) {
    endUtc = new Date(startUtc.getTime() + HOUR_MS);
  }

  return { kind: 'timed', start: startUtc, end: endUtc, startTimeZone };
}

/** 2026-09-16T23:00:00.000Z → 20260916T230000Z */
export function toGcalUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
