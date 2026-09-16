import { describe, expect, it } from 'vitest';
import { parseExtraction } from '../src/llm/parse';
import { event, moment } from './helpers';

describe('parseExtraction', () => {
  it('accepts a valid response, including one wrapped in a markdown fence', () => {
    const payload = JSON.stringify({ events: [event()] });
    for (const content of [payload, '```json\n' + payload + '\n```']) {
      const result = parseExtraction(content);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.events).toHaveLength(1);
    }
  });

  it('accepts an empty event list', () => {
    const result = parseExtraction(JSON.stringify({ events: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    const result = parseExtraction('not json');
    expect(result.ok).toBe(false);
  });

  it('rejects a response missing required fields', () => {
    const result = parseExtraction(JSON.stringify({ events: [{ title: 'Missing everything else' }] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('normalizes a 12h time instead of rejecting it', () => {
    const withAmPm = event({ start: { ...moment('2026-09-16', '6:00 PM'), timeZoneInferred: false } });
    const result = parseExtraction(JSON.stringify({ events: [withAmPm] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events[0]!.start.time).toBe('18:00');
  });

  it('still rejects genuinely unparseable date/time text', () => {
    const bad = event({ start: { ...moment('sometime soon', 'later'), timeZoneInferred: false } });
    const result = parseExtraction(JSON.stringify({ events: [bad] }));
    expect(result.ok).toBe(false);
  });
});
