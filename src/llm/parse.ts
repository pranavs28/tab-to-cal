import { normalizeExtractionPayload } from '../normalize';
import { extractionSchema, type CalendarEvent } from '../schema';

export type ParseResult = { ok: true; events: CalendarEvent[] } | { ok: false; error: string };

/** Parses and validates a model's raw text response, normalizing common
 * alternate date/time formats first (see src/normalize.ts for why). */
export function parseExtraction(content: string, referenceYear = new Date().getFullYear()): ParseResult {
  const json = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  const result = extractionSchema.safeParse(normalizeExtractionPayload(data, referenceYear));
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, events: result.data.events };
}
