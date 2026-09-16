import { describe, expect, it, vi } from 'vitest';
import { completeGemini } from '../../src/llm/providers/gemini';

const messages = [
  { role: 'system' as const, content: 'be terse' },
  { role: 'user' as const, content: 'hi' },
  { role: 'assistant' as const, content: 'ok' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('completeGemini', () => {
  it('puts the model in the URL, the key in a header, and maps assistant -> model role', async () => {
    let capturedUrl = '';
    let capturedHeaders: HeadersInit | undefined;
    let captured: any;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers;
      captured = JSON.parse((init?.body as string) ?? '{}');
      return jsonResponse({ candidates: [{ content: { parts: [{ text: '{"events":[]}' }] } }] });
    });

    const result = await completeGemini({ apiKey: 'k', model: 'gemini-3.5-flash-lite', fetchImpl }, messages);

    expect(result).toBe('{"events":[]}');
    expect(capturedUrl).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect((capturedHeaders as Record<string, string>)['x-goog-api-key']).toBe('k');
    expect(captured.systemInstruction.parts[0].text).toBe('be terse');
    expect(captured.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'ok' }] },
    ]);
    expect(captured.generationConfig.responseMimeType).toBe('application/json');
  });

  it('omits systemInstruction when there is no system message', async () => {
    let captured: any;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? '{}');
      return jsonResponse({ candidates: [{ content: { parts: [{ text: '{"events":[]}' }] } }] });
    });
    await completeGemini({ apiKey: 'k', model: 'm', fetchImpl }, [{ role: 'user', content: 'hi' }]);
    expect(captured.systemInstruction).toBeUndefined();
  });

  it('maps HTTP status codes to the right error codes', async () => {
    const cases: [number, string][] = [
      [401, 'bad_key'],
      [403, 'bad_key'],
      [429, 'rate_limited'],
      [404, 'model_unavailable'],
      [500, 'api'],
    ];
    for (const [status, code] of cases) {
      const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: 'nope' } }, status));
      await expect(completeGemini({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toMatchObject({ code });
    }
  });
});
