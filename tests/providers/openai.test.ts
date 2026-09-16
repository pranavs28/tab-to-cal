import { describe, expect, it, vi } from 'vitest';
import { completeOpenAI } from '../../src/llm/providers/openai';

const messages = [
  { role: 'system' as const, content: 'be terse' },
  { role: 'user' as const, content: 'hi' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('completeOpenAI', () => {
  it('maps system to developer, requests json_schema, and reads output_text', async () => {
    let captured: any;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      captured = JSON.parse((init?.body as string) ?? '{}');
      return jsonResponse({
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"events":[]}' }] }],
      });
    });

    const result = await completeOpenAI({ apiKey: 'k', model: 'gpt-5.6-luna', fetchImpl }, messages);

    expect(result).toBe('{"events":[]}');
    expect(captured.input[0]).toEqual({ type: 'message', role: 'developer', content: 'be terse' });
    expect(captured.input[1]).toEqual({ type: 'message', role: 'user', content: 'hi' });
    expect(captured.text.format.type).toBe('json_schema');
    expect(captured.text.format.strict).toBe(true);
  });

  it('maps HTTP status codes to the right error codes', async () => {
    const cases: [number, string][] = [
      [401, 'bad_key'],
      [429, 'rate_limited'],
      [404, 'model_unavailable'],
      [500, 'api'],
    ];
    for (const [status, code] of cases) {
      const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: 'nope' } }, status));
      await expect(completeOpenAI({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toMatchObject({ code });
    }
  });

  it('throws invalid_output when no output_text is found', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ output: [] }));
    await expect(completeOpenAI({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });
});
