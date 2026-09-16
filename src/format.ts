import type { CalendarEvent } from './schema';
import { resolveTimes } from './time';

export function describeWhen(event: CalendarEvent, fallbackTimeZone: string, locale?: string): string {
  const times = resolveTimes(event, fallbackTimeZone);
  if (times.kind === 'allDay') {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const start = fmt.format(new Date(`${times.startDate}T00:00:00Z`));
    const lastDay = new Date(`${times.endDateExclusive}T00:00:00Z`).getTime() - 86_400_000;
    const end = fmt.format(new Date(lastDay));
    return start === end ? `${start} · all day` : `${start} – ${end}`;
  }
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: times.startTimeZone,
    timeZoneName: 'short',
  });
  return fmt.format(times.start);
}

export function needsReview(event: CalendarEvent): boolean {
  return event.timeGuessed || event.start.timeZoneInferred || Boolean(event.end?.timeZoneInferred);
}
