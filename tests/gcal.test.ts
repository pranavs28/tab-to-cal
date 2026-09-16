import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX_CHARS, FOOTER_TEXT, buildDetails, buildGcalUrl } from '../src/gcal';
import { event, moment } from './helpers';

function params(url: string) {
  return new URL(url).searchParams;
}

describe('buildGcalUrl', () => {
  it('builds a timed event URL in UTC with the start timezone for display', () => {
    const url = buildGcalUrl(
      event({
        title: 'Flight ORD → BOS',
        start: moment('2026-09-16', '18:00', 'America/Chicago'),
        end: moment('2026-09-16', '21:00', 'America/New_York'),
        location: "O'Hare International Airport",
      }),
      { fallbackTimeZone: 'UTC' },
    );
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    const p = params(url);
    expect(p.get('action')).toBe('TEMPLATE');
    expect(p.get('text')).toBe('Flight ORD → BOS');
    expect(p.get('dates')).toBe('20260916T230000Z/20260917T010000Z');
    expect(p.get('ctz')).toBe('America/Chicago');
    expect(p.get('location')).toBe("O'Hare International Airport");
  });

  it('builds all-day dates without ctz', () => {
    const p = params(buildGcalUrl(event({ start: moment('2026-09-16', null) }), { fallbackTimeZone: 'UTC' }));
    expect(p.get('dates')).toBe('20260916/20260917');
    expect(p.has('ctz')).toBe(false);
  });

  it('adds recurrence with a single RRULE prefix', () => {
    const withPrefix = buildGcalUrl(event({ recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=TU' }), { fallbackTimeZone: 'UTC' });
    const without = buildGcalUrl(event({ recurrence: 'FREQ=WEEKLY;BYDAY=TU' }), { fallbackTimeZone: 'UTC' });
    expect(params(withPrefix).get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU');
    expect(params(without).get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU');
  });

  it('targets a Google account when an email is set', () => {
    const p = params(buildGcalUrl(event(), { fallbackTimeZone: 'UTC', accountEmail: 'me@example.com' }));
    expect(p.get('authuser')).toBe('me@example.com');
  });

  it('omits empty optional params other than details (which always carries the footer)', () => {
    const p = params(buildGcalUrl(event(), { fallbackTimeZone: 'UTC' }));
    for (const key of ['location', 'recur', 'authuser']) expect(p.has(key)).toBe(false);
    expect(p.get('details')).toBe(FOOTER_TEXT);
  });
});

describe('buildDetails', () => {
  it('puts the source URL first and the footer last', () => {
    expect(buildDetails('Bring ID', 'https://example.com/e')).toBe(
      `Source: https://example.com/e\n\nBring ID\n\n${FOOTER_TEXT}`,
    );
  });

  it('includes just the footer when there is no description or source', () => {
    expect(buildDetails(null)).toBe(FOOTER_TEXT);
  });

  it('caps overall length, truncating the description but keeping the footer intact', () => {
    const details = buildDetails('x'.repeat(5000), 'https://example.com');
    expect(details.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(details.startsWith('Source: https://example.com')).toBe(true);
    expect(details.endsWith(FOOTER_TEXT)).toBe(true);
    expect(details).toContain('…');
  });
});
