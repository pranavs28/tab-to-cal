import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import {
  captureFromDocument,
  fetchGoogleDocText,
  googleDocExportUrl,
  normalizeWhitespace,
  truncate,
  type ReadabilityCtor,
} from '../src/capture';

const FakeReadability: ReadabilityCtor = class {
  constructor(private doc: Document) {}
  parse() {
    const text = this.doc.querySelector('article')?.textContent ?? '';
    return text ? { textContent: text } : null;
  }
};

function docFrom(html: string, url = 'https://example.com/page') {
  const { document } = parseHTML(`<!doctype html><html><head><title>Test page</title></head><body>${html}</body></html>`);
  return { document: document as unknown as Document, url };
}

describe('googleDocExportUrl', () => {
  it('builds an export URL from a document link', () => {
    expect(googleDocExportUrl('https://docs.google.com/document/d/abc123XYZ/edit')).toBe(
      'https://docs.google.com/document/d/abc123XYZ/export?format=txt',
    );
  });

  it('handles a multi-account /u/1/ prefix', () => {
    expect(googleDocExportUrl('https://docs.google.com/document/u/1/d/abc123/edit')).toBe(
      'https://docs.google.com/document/d/abc123/export?format=txt',
    );
  });

  it('returns null for non-Docs URLs', () => {
    expect(googleDocExportUrl('https://docs.google.com/spreadsheets/d/abc123/edit')).toBeNull();
    expect(googleDocExportUrl('https://example.com')).toBeNull();
  });
});

describe('normalizeWhitespace / truncate', () => {
  it('collapses repeated blank lines and trailing spaces', () => {
    expect(normalizeWhitespace('Line one   \n\n\n\nLine two\t\ttab')).toBe('Line one\n\nLine two tab');
  });

  it('truncates to the character cap', () => {
    expect(truncate('x'.repeat(100), 10)).toHaveLength(10);
  });
});

describe('fetchGoogleDocText', () => {
  it('returns the exported text on success', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => 'Meeting notes: standup at 10am' })) as any;
    expect(await fetchGoogleDocText('https://docs.google.com/document/d/x/export?format=txt', fetchImpl)).toBe(
      'Meeting notes: standup at 10am',
    );
  });

  it('returns null when the export is an HTML sign-in page instead of text', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => '<!doctype html><html>sign in</html>' })) as any;
    expect(await fetchGoogleDocText('https://docs.google.com/document/d/x/export?format=txt', fetchImpl)).toBeNull();
  });

  it('returns null on a non-ok response or network failure', async () => {
    expect(await fetchGoogleDocText('u', vi.fn(async () => ({ ok: false, text: async () => '' })) as any)).toBeNull();
    expect(
      await fetchGoogleDocText(
        'u',
        vi.fn(async () => {
          throw new Error('offline');
        }) as any,
      ),
    ).toBeNull();
  });
});

describe('captureFromDocument', () => {
  it('prefers a non-trivial selection over everything else', async () => {
    const { document, url } = docFrom('<article>Ignored article text that is long enough to pass.</article>');
    const capture = await captureFromDocument(document, url, 'Concert at 8pm Friday, Main Hall', FakeReadability);
    expect(capture.source).toBe('selection');
    expect(capture.text).toBe('Concert at 8pm Friday, Main Hall');
  });

  it('ignores a trivially short selection and falls through', async () => {
    const { document, url } = docFrom(
      `<article>${'Full article body with plenty of detail to extract from. '.repeat(5)}</article>`,
    );
    const capture = await captureFromDocument(document, url, 'hi', FakeReadability);
    expect(capture.source).toBe('readability');
  });

  it('uses the Google Docs export when on a Docs URL', async () => {
    const { document } = docFrom('<div>irrelevant canvas shell</div>');
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => 'Team offsite Oct 3rd, 9am, Room 4' })) as any;
    const capture = await captureFromDocument(
      document,
      'https://docs.google.com/document/d/doc123/edit',
      '',
      FakeReadability,
      fetchImpl,
    );
    expect(capture.source).toBe('google-docs');
    expect(capture.text).toBe('Team offsite Oct 3rd, 9am, Room 4');
  });

  it('reads the Gmail message pane on mail.google.com', async () => {
    const { document } = docFrom(
      '<div role="main">Your flight UA123 departs 6pm from ORD, arriving BOS at 9pm.</div>',
      'https://mail.google.com/mail/u/0/#inbox/abc',
    );
    const capture = await captureFromDocument(document, 'https://mail.google.com/mail/u/0/#inbox/abc', '', FakeReadability);
    expect(capture.source).toBe('gmail');
    expect(capture.text).toContain('UA123');
  });

  it('falls back to Readability, then the raw body', async () => {
    const { document, url } = docFrom('<article>' + 'Event details. '.repeat(20) + '</article>');
    expect((await captureFromDocument(document, url, '', FakeReadability)).source).toBe('readability');

    const { document: plain, url: plainUrl } = docFrom('<p>Just some plain body text.</p>');
    expect((await captureFromDocument(plain, plainUrl, '', FakeReadability)).source).toBe('body');
  });
});
