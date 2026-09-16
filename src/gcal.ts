import type { CalendarEvent } from './schema';
import { resolveTimes, toGcalUtcStamp } from './time';

export const DESCRIPTION_MAX_CHARS = 1500;

export interface GcalUrlOptions {
  fallbackTimeZone: string;
  sourceUrl?: string;
  accountEmail?: string;
}

export function buildDetails(description: string | null, sourceUrl?: string): string {
  const header = sourceUrl ? `Source: ${sourceUrl}` : '';
  const body = description?.trim() ?? '';
  const full = [header, body].filter(Boolean).join('\n\n');
  if (full.length <= DESCRIPTION_MAX_CHARS) return full;
  return full.slice(0, DESCRIPTION_MAX_CHARS - 1).trimEnd() + '…';
}

export function buildGcalUrl(event: CalendarEvent, options: GcalUrlOptions): string {
  const times = resolveTimes(event, options.fallbackTimeZone);
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
  ];

  if (times.kind === 'allDay') {
    params.push(['dates', `${times.startDate.replace(/-/g, '')}/${times.endDateExclusive.replace(/-/g, '')}`]);
  } else {
    params.push(['dates', `${toGcalUtcStamp(times.start)}/${toGcalUtcStamp(times.end)}`]);
    // Show the form in the start's timezone, e.g. a flight in departure time.
    params.push(['ctz', times.startTimeZone]);
  }

  const details = buildDetails(event.description, options.sourceUrl);
  if (details) params.push(['details', details]);
  if (event.location) params.push(['location', event.location]);
  if (event.recurrence) {
    params.push(['recur', `RRULE:${event.recurrence.replace(/^RRULE:/i, '')}`]);
  }
  if (options.accountEmail) params.push(['authuser', options.accountEmail]);

  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}
