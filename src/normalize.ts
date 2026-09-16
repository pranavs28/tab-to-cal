/**
 * Best-effort cleanup of the date/time strings an LLM returns, run before
 * schema validation. `json_schema` structured-output mode enforces JSON
 * *shape* (keys, types), but most providers don't actually enforce string
 * `pattern`s during constrained decoding — so a model can return a
 * perfectly well-formed object with "Sat, Sep 19, 2026" in a `date` field.
 * Rather than reject and retry (expensive, and not guaranteed to help), we
 * try to coerce common alternate formats into the canonical ones ourselves.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/** "2026-9-19" / "2026-09-19" -> "2026-09-19". Returns null if unrecognized. */
export function normalizeDate(raw: string, referenceYear: number): string | null {
  const s = raw.trim();

  let m = s.match(ISO_DATE);
  if (m) return `${m[1]}-${pad(+m[2]!)}-${pad(+m[3]!)}`;

  // MM/DD/YYYY or M/D/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[1]!)}-${pad(+m[2]!)}`;

  // "Sep 19, 2026" / "September 19, 2026" / "Sat, Sep 19, 2026" / "Sep 19" (no year)
  m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/);
  if (m) {
    const month = MONTHS[m[1]!.toLowerCase()];
    if (month) return `${m[3] ? Number(m[3]) : referenceYear}-${pad(month)}-${pad(+m[2]!)}`;
  }

  return null;
}

const TIME_24H = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const TIME_12H = /^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)$/i;

/** "6:00 PM" / "6pm" / "18:00:00" -> "18:00". Returns null if unrecognized. */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim();

  let m = s.match(TIME_12H);
  if (m) {
    let hour = Number(m[1]) % 12;
    if (/p/i.test(m[3]!)) hour += 12;
    return `${pad(hour)}:${m[2] ?? '00'}`;
  }

  m = s.match(TIME_24H);
  if (m) {
    const hour = Number(m[1]);
    if (hour <= 23) return `${pad(hour)}:${m[2]}`;
  }

  return null;
}

interface RawMoment {
  date?: unknown;
  time?: unknown;
  [key: string]: unknown;
}

function normalizeMoment(moment: RawMoment | null | undefined, referenceYear: number): void {
  if (!moment || typeof moment !== 'object') return;

  if (typeof moment.date === 'string' && !ISO_DATE.test(moment.date.trim())) {
    // A combined ISO datetime ("2026-09-19T18:00:00") sometimes ends up in `date`.
    const combined = moment.date.match(/^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}:\d{2})/);
    if (combined) {
      moment.date = combined[1];
      if (moment.time == null || moment.time === '') moment.time = combined[2];
    } else {
      const normalized = normalizeDate(moment.date, referenceYear);
      if (normalized) moment.date = normalized;
    }
  }

  if (typeof moment.time === 'string' && moment.time.trim() !== '' && !TIME_24H.test(moment.time.trim())) {
    const normalized = normalizeTime(moment.time);
    if (normalized) moment.time = normalized;
  }
}

/** Mutates and returns `data` with best-effort normalized date/time fields. */
export function normalizeExtractionPayload(data: unknown, referenceYear: number): unknown {
  if (!data || typeof data !== 'object' || !Array.isArray((data as any).events)) return data;
  for (const event of (data as any).events) {
    if (!event || typeof event !== 'object') continue;
    normalizeMoment(event.start, referenceYear);
    normalizeMoment(event.end, referenceYear);
  }
  return data;
}
