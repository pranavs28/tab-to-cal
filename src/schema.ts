import { z } from 'zod';

// Times are kept exactly as written on the page. The LLM never converts
// between timezones; src/time.ts does that deterministically.
const moment = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  timeZone: z.string().nullable(),
  timeZoneInferred: z.boolean(),
});

export const calendarEventSchema = z.object({
  title: z.string().min(1),
  start: moment,
  end: moment.nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  recurrence: z.string().nullable(),
  timeGuessed: z.boolean(),
});

export const extractionSchema = z.object({
  events: z.array(calendarEventSchema),
});

export type Moment = z.infer<typeof moment>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

// Hand-written so it stays within what strict json_schema mode accepts
// (every property required, nullability via type unions, no extra keys).
const momentJson = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'time', 'timeZone', 'timeZoneInferred'],
  properties: {
    date: { type: 'string', description: 'Local calendar date, YYYY-MM-DD' },
    time: {
      type: ['string', 'null'],
      description: '24h local wall-clock time HH:MM as shown on the page; null if no time is given',
    },
    timeZone: {
      type: ['string', 'null'],
      description:
        'IANA timezone of this moment (e.g. America/Chicago). Stated on the page, or inferred from the location of this moment. null if neither is possible.',
    },
    timeZoneInferred: {
      type: 'boolean',
      description: 'true if timeZone was inferred from a location rather than stated',
    },
  },
} as const;

export const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'start', 'end', 'location', 'description', 'recurrence', 'timeGuessed'],
        properties: {
          title: { type: 'string' },
          start: momentJson,
          end: { anyOf: [momentJson, { type: 'null' }] },
          location: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          recurrence: {
            type: ['string', 'null'],
            description: 'RFC 5545 RRULE body without the "RRULE:" prefix, e.g. FREQ=WEEKLY;BYDAY=TU;COUNT=10',
          },
          timeGuessed: {
            type: 'boolean',
            description: 'true if the date or time had to be guessed because the page was ambiguous',
          },
        },
      },
    },
  },
} as const;
