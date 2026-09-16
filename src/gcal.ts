import type { CalendarEvent } from './schema';
import { resolveTimes, toGcalUtcStamp } from './time';

export const DESCRIPTION_MAX_CHARS = 1500;

// TODO: link to the extension's listing once it's published.
export const FOOTER_TEXT = 'Added with Tab to Cal';

export interface GcalUrlOptions {
  fallbackTimeZone: string;
  sourceUrl?: string;
  accountEmail?: string;
}

/** Source link + description + a "made with" footer, truncating the
 * description (never the header or footer) to fit the cap. */
export function buildDetails(description: string | null, sourceUrl?: string): string {
  const header = sourceUrl ? `Source: ${sourceUrl}` : '';
  const footer = FOOTER_TEXT;
  const body = description?.trim() ?? '';

  const fixedLength = [header, footer].filter(Boolean).join('\n\n').length;
  const separators = (header ? 2 : 0) + 2; // blank line after header (if any), and before the footer
  const bodyBudget = Math.max(0, DESCRIPTION_MAX_CHARS - fixedLength - separators);

  const truncatedBody = body.length <= bodyBudget ? body : bodyBudget > 1 ? body.slice(0, bodyBudget - 1).trimEnd() + '…' : '';

  const full = [header, truncatedBody, footer].filter(Boolean).join('\n\n');
  return full.length <= DESCRIPTION_MAX_CHARS ? full : full.slice(0, DESCRIPTION_MAX_CHARS - 1).trimEnd() + '…';
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
