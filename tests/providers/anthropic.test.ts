import { describe, expect, it, vi } from 'vitest';
import { completeAnthropic } from '../../src/llm/providers/anthropic';

const messages = [
  { role: 'system' as const, content: 'be terse' },
  { role: 'user' as const, content: 'hi' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('completeAnthropic', () => {
  it('sends system separately from messages and returns the text block', async () => {
    let captured: any;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? '{}');
      return jsonResponse({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5-20251001',
        content: [{ type: 'text', text: '{"events":[]}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });

    const result = await completeAnthropic(
      { apiKey: 'k', model: 'claude-haiku-4-5-20251001', fetchImpl: fetchImpl as unknown as typeof fetch },
      messages,
    );

    expect(result).toBe('{"events":[]}');
    expect(captured.system).toBe('be terse');
    expect(captured.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(captured.output_config.format.type).toBe('json_schema');
  });

  it('maps HTTP status codes to the right error codes', async () => {
    const cases: [number, string][] = [
      [401, 'bad_key'],
      [429, 'rate_limited'],
      [404, 'model_unavailable'],
      [500, 'api'],
    ];
    for (const [status, code] of cases) {
      const fetchImpl = vi.fn(
        async () => jsonResponse({ type: 'error', error: { type: 'x', message: 'nope' } }, status) as any,
      );
      await expect(
        completeAnthropic(
          { apiKey: 'k', model: 'm', fetchImpl: fetchImpl as unknown as typeof fetch },
          messages,
        ),
      ).rejects.toMatchObject({ code });
    }
  });
});
