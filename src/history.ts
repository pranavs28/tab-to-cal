import type { CalendarEvent } from './schema';

export const HISTORY_LIMIT = 20;

export type RunResult =
  | { status: 'pending'; key: string; url: string; title: string; startedAt: number }
  | { status: 'done'; key: string; url: string; title: string; finishedAt: number; events: CalendarEvent[]; gcalUrls: string[] }
  | { status: 'error'; key: string; url: string; title: string; finishedAt: number; message: string };

export async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function resultKey(url: string, text: string): Promise<string> {
  return `${url}#${await hashText(text)}`;
}

async function readAll(): Promise<RunResult[]> {
  const stored = await chrome.storage.local.get('history');
  return (stored.history as RunResult[] | undefined) ?? [];
}

export async function findResult(key: string): Promise<RunResult | undefined> {
  return (await readAll()).find((r) => r.key === key);
}

export async function latestResultForUrl(url: string): Promise<RunResult | undefined> {
  return (await readAll()).find((r) => r.url === url);
}

/** Inserts or replaces a result, newest first, capped at HISTORY_LIMIT. */
export async function putResult(result: RunResult): Promise<void> {
  const rest = (await readAll()).filter((r) => r.key !== result.key);
  await chrome.storage.local.set({ history: [result, ...rest].slice(0, HISTORY_LIMIT) });
}
