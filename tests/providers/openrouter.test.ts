import { describe, expect, it, vi } from 'vitest';
import { ExtractError } from '../../src/llm/errors';
import { completeOpenRouter } from '../../src/llm/providers/openrouter';

const messages = [{ role: 'user' as const, content: 'hi' }];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('completeOpenRouter', () => {
  it('posts a json_schema request and returns the message content', async () => {
    let captured: any;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? '{}');
      return jsonResponse({ choices: [{ message: { content: '{"events":[]}' } }] });
    });

    const result = await completeOpenRouter({ apiKey: 'k', model: 'm', fetchImpl }, messages);

    expect(result).toBe('{"events":[]}');
    expect(captured.model).toBe('m');
    expect(captured.response_format.type).toBe('json_schema');
    expect(captured.response_format.json_schema.strict).toBe(true);
    expect(captured.provider.require_parameters).toBe(true);
  });

  it('maps HTTP status codes to the right error codes', async () => {
    const cases: [number, string][] = [
      [401, 'bad_key'],
      [402, 'no_credits'],
      [429, 'rate_limited'],
      [404, 'model_unavailable'],
      [500, 'api'],
    ];
    for (const [status, code] of cases) {
      const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: 'nope' } }, status));
      await expect(completeOpenRouter({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toMatchObject({
        code,
      });
    }
  });

  it('throws invalid_output on an empty response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { content: '' } }] }));
    await expect(completeOpenRouter({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });

  it('throws a network error when fetch itself fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(completeOpenRouter({ apiKey: 'k', model: 'm', fetchImpl }, messages)).rejects.toBeInstanceOf(
      ExtractError,
    );
  });
});
