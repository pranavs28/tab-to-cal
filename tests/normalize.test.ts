import { describe, expect, it } from 'vitest';
import { normalizeDate, normalizeExtractionPayload, normalizeTime } from '../src/normalize';
import { event, moment } from './helpers';

describe('normalizeDate', () => {
  it('passes through an already-ISO date, padding single digits', () => {
    expect(normalizeDate('2026-09-19', 2026)).toBe('2026-09-19');
    expect(normalizeDate('2026-9-19', 2026)).toBe('2026-09-19');
  });

  it('converts US slash format', () => {
    expect(normalizeDate('9/19/2026', 2026)).toBe('2026-09-19');
  });

  it('converts month-name formats, with or without a leading weekday', () => {
    expect(normalizeDate('September 19, 2026', 2026)).toBe('2026-09-19');
    expect(normalizeDate('Sep 19, 2026', 2026)).toBe('2026-09-19');
    expect(normalizeDate('Sat, Sep 19, 2026', 2026)).toBe('2026-09-19');
  });

  it('falls back to the reference year when none is given', () => {
    expect(normalizeDate('Sep 19', 2026)).toBe('2026-09-19');
  });

  it('returns null for unrecognized text', () => {
    expect(normalizeDate('next Friday', 2026)).toBeNull();
  });
});

describe('normalizeTime', () => {
  it('passes through 24h time, padding single digits', () => {
    expect(normalizeTime('18:00')).toBe('18:00');
    expect(normalizeTime('6:00')).toBe('06:00');
  });

  it('strips seconds', () => {
    expect(normalizeTime('18:00:00')).toBe('18:00');
  });

  it('converts 12h with AM/PM, with or without a period or space', () => {
    expect(normalizeTime('6:00 PM')).toBe('18:00');
    expect(normalizeTime('6:00pm')).toBe('18:00');
    expect(normalizeTime('6:00 p.m.')).toBe('18:00');
    expect(normalizeTime('12:00 AM')).toBe('00:00');
    expect(normalizeTime('12:00 PM')).toBe('12:00');
  });

  it('converts an hour-only 12h time', () => {
    expect(normalizeTime('6pm')).toBe('18:00');
  });

  it('returns null for unrecognized text', () => {
    expect(normalizeTime('noon')).toBeNull();
  });
});

describe('normalizeExtractionPayload', () => {
  it('normalizes every event start/end in place', () => {
    const data = {
      events: [
        event({
          start: moment('Sat, Sep 19, 2026', '6:00 PM', 'America/Chicago'),
          end: moment('Sat, Sep 19, 2026', '9:00 PM', 'America/New_York'),
        }),
      ],
    };
    const result = normalizeExtractionPayload(data, 2026) as typeof data;
    expect(result.events[0]!.start.date).toBe('2026-09-19');
    expect(result.events[0]!.start.time).toBe('18:00');
    expect(result.events[0]!.end!.date).toBe('2026-09-19');
    expect(result.events[0]!.end!.time).toBe('21:00');
  });

  it('splits a combined ISO datetime placed in `date` into date + time', () => {
    const data = { events: [event({ start: { ...moment('', null), date: '2026-09-19T18:00:00' } })] };
    const result = normalizeExtractionPayload(data, 2026) as typeof data;
    expect(result.events[0]!.start.date).toBe('2026-09-19');
    expect(result.events[0]!.start.time).toBe('18:00');
  });

  it('leaves an already-valid payload untouched', () => {
    const data = { events: [event()] };
    const result = normalizeExtractionPayload(data, 2026) as typeof data;
    expect(result.events[0]!.start).toEqual(event().start);
  });

  it('passes through non-conforming input without throwing', () => {
    expect(normalizeExtractionPayload({ events: 'not an array' }, 2026)).toEqual({ events: 'not an array' });
    expect(normalizeExtractionPayload(null, 2026)).toBeNull();
    expect(normalizeExtractionPayload({ events: [null] }, 2026)).toEqual({ events: [null] });
  });
});
