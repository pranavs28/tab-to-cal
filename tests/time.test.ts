import { describe, expect, it } from 'vitest';
import { addDays, resolveTimes, toGcalUtcStamp, zonedToUtc } from '../src/time';
import { event, moment } from './helpers';

describe('zonedToUtc', () => {
  it('converts Chicago wall time to UTC (CDT)', () => {
    expect(zonedToUtc('2026-09-16', '18:00', 'America/Chicago').toISOString()).toBe('2026-09-16T23:00:00.000Z');
  });

  it('uses standard time after the DST change', () => {
    expect(zonedToUtc('2026-12-01', '18:00', 'America/Chicago').toISOString()).toBe('2026-12-02T00:00:00.000Z');
  });

  it('handles a zone east of UTC with a date rollback', () => {
    expect(zonedToUtc('2026-09-17', '07:30', 'Asia/Tokyo').toISOString()).toBe('2026-09-16T22:30:00.000Z');
  });

  it('handles half-hour offsets', () => {
    expect(zonedToUtc('2026-09-16', '12:00', 'Asia/Kolkata').toISOString()).toBe('2026-09-16T06:30:00.000Z');
  });
});

describe('resolveTimes', () => {
  it('schedules a cross-timezone flight by real duration', () => {
    const flight = event({
      start: moment('2026-09-16', '18:00', 'America/Chicago'),
      end: moment('2026-09-16', '21:00', 'America/New_York'),
    });
    const times = resolveTimes(flight, 'America/Los_Angeles');
    expect(times.kind).toBe('timed');
    if (times.kind !== 'timed') return;
    expect(toGcalUtcStamp(times.start)).toBe('20260916T230000Z');
    expect(toGcalUtcStamp(times.end)).toBe('20260917T010000Z');
    expect(times.startTimeZone).toBe('America/Chicago');
  });

  it('defaults a missing end to one hour', () => {
    const times = resolveTimes(event({ start: moment('2026-09-16', '09:00', 'UTC') }), 'UTC');
    if (times.kind !== 'timed') throw new Error('expected timed');
    expect(times.end.getTime() - times.start.getTime()).toBe(60 * 60 * 1000);
  });

  it('falls back to the browser timezone when none is known or valid', () => {
    const times = resolveTimes(event({ start: moment('2026-09-16', '09:00', 'Not/AZone') }), 'Europe/London');
    if (times.kind !== 'timed') throw new Error('expected timed');
    expect(times.startTimeZone).toBe('Europe/London');
    expect(times.start.toISOString()).toBe('2026-09-16T08:00:00.000Z');
  });

  it('lets an end without a timezone share the start timezone', () => {
    const times = resolveTimes(
      event({ start: moment('2026-09-16', '09:00', 'Asia/Tokyo'), end: moment('2026-09-16', '11:00') }),
      'UTC',
    );
    if (times.kind !== 'timed') throw new Error('expected timed');
    expect(times.end.getTime() - times.start.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('rolls an overnight end onto the next day', () => {
    const times = resolveTimes(
      event({ start: moment('2026-09-16', '22:00', 'UTC'), end: moment('2026-09-16', '01:00', 'UTC') }),
      'UTC',
    );
    if (times.kind !== 'timed') throw new Error('expected timed');
    expect(times.end.toISOString()).toBe('2026-09-17T01:00:00.000Z');
  });

  it('makes events without a time all-day with an exclusive end date', () => {
    expect(resolveTimes(event({ start: moment('2026-09-16', null) }), 'UTC')).toEqual({
      kind: 'allDay',
      startDate: '2026-09-16',
      endDateExclusive: '2026-09-17',
    });
  });

  it('spans multi-day all-day events', () => {
    expect(
      resolveTimes(event({ start: moment('2026-12-30', null), end: moment('2027-01-02', null) }), 'UTC'),
    ).toEqual({ kind: 'allDay', startDate: '2026-12-30', endDateExclusive: '2027-01-03' });
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
