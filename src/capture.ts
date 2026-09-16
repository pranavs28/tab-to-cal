export const INPUT_MAX_CHARS = 30_000;
export const MIN_TEXT_CHARS = 40;
const MIN_SELECTION_CHARS = 10;

export type CaptureSource = 'selection' | 'google-docs' | 'gmail' | 'readability' | 'body';

export interface Capture {
  text: string;
  title: string;
  url: string;
  source: CaptureSource;
}

interface ReadabilityLike {
  parse(): { textContent?: string | null } | null;
}
export type ReadabilityCtor = new (doc: Document) => ReadabilityLike;

export function googleDocExportUrl(url: string): string | null {
  const match = url.match(/^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]+)/);
  return match ? `https://docs.google.com/document/d/${match[1]}/export?format=txt` : null;
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(text: string, max = INPUT_MAX_CHARS): string {
  return text.length <= max ? text : text.slice(0, max);
}

function finish(text: string, doc: Document, url: string, source: CaptureSource): Capture {
  return { text: truncate(normalizeWhitespace(text)), title: doc.title, url, source };
}

export async function fetchGoogleDocText(exportUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(exportUrl, { credentials: 'include' });
    if (!response.ok) return null;
    const text = await response.text();
    // A signed-out or permission-denied export returns an HTML page instead.
    return /^\s*<(!doctype|html)/i.test(text) ? null : text;
  } catch {
    return null;
  }
}

function textOf(el: Element | null): string {
  if (!el) return '';
  return (el as HTMLElement).innerText ?? el.textContent ?? '';
}

/**
 * Picks the best text on the page: the user's selection, then site-specific
 * sources (Google Docs export, Gmail's message pane), then a Readability
 * article, then the whole body.
 */
export async function captureFromDocument(
  doc: Document,
  url: string,
  selection: string,
  Readability: ReadabilityCtor,
  fetchImpl: typeof fetch = fetch,
): Promise<Capture> {
  if (selection.trim().length >= MIN_SELECTION_CHARS) return finish(selection, doc, url, 'selection');

  const exportUrl = googleDocExportUrl(url);
  if (exportUrl) {
    const text = await fetchGoogleDocText(exportUrl, fetchImpl);
    if (text) return finish(text, doc, url, 'google-docs');
  }

  if (new URL(url).hostname === 'mail.google.com') {
    const text = textOf(doc.querySelector('[role="main"]'));
    if (text.trim().length >= MIN_TEXT_CHARS) return finish(text, doc, url, 'gmail');
  }

  try {
    const article = new Readability(doc.cloneNode(true) as Document).parse();
    const text = article?.textContent ?? '';
    if (text.trim().length >= 200) return finish(text, doc, url, 'readability');
  } catch {
    // Fall through to the raw body text.
  }

  return finish(textOf(doc.body), doc, url, 'body');
}
