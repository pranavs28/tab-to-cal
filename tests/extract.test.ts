import { describe, expect, it, vi } from 'vitest';
import { extractEvents } from '../src/llm/extract';
import { ExtractError } from '../src/llm/errors';
import type { CompleteFn, Provider } from '../src/llm/providers/types';
import { SHARED_GEMINI_MODEL } from '../src/llm/providers/types';

const ctx = {
  text: 'some page text',
  pageTitle: 't',
  pageUrl: 'https://example.com',
  now: new Date('2026-09-16T00:00:00Z'),
  browserTimeZone: 'UTC',
};

function fns(overrides: Partial<Record<Provider, CompleteFn>>): Record<Provider, CompleteFn> {
  const never: CompleteFn = async () => {
    throw new Error('should not be called');
  };
  return { openrouter: never, openai: never, anthropic: never, gemini: never, ...overrides };
}

describe('extractEvents', () => {
  it('throws no_key when the key is missing for a normal provider', async () => {
    await expect(
      extractEvents({ ...ctx, provider: 'openai', apiKey: '', model: 'm', fallbackModels: [] }, fns({})),
    ).rejects.toMatchObject({ code: 'no_key' });
  });

  it('uses the shared Gemini model when Gemini has no key, ignoring configured model/fallbacks', async () => {
    let capturedModel = '';
    const gemini: CompleteFn = async (options) => {
      capturedModel = options.model;
      return '{"events":[]}';
    };
    const events = await extractEvents(
      { ...ctx, provider: 'gemini', apiKey: '', model: 'ignored-model', fallbackModels: ['also-ignored'] },
      fns({ gemini }),
    );
    expect(events).toEqual([]);
    expect(capturedModel).toBe(SHARED_GEMINI_MODEL);
  });

  it('does not throw no_key for Gemini with no key', async () => {
    const gemini: CompleteFn = async () => '{"events":[]}';
    await expect(
      extractEvents({ ...ctx, provider: 'gemini', apiKey: '', model: 'x', fallbackModels: [] }, fns({ gemini })),
    ).resolves.toEqual([]);
  });

  it('falls back to the next model on a recoverable error', async () => {
    let calls = 0;
    const openai: CompleteFn = async (options) => {
      calls++;
      if (options.model === 'first') throw new ExtractError('rate_limited', 'nope');
      return '{"events":[]}';
    };
    const events = await extractEvents(
      { ...ctx, provider: 'openai', apiKey: 'k', model: 'first', fallbackModels: ['second'] },
      fns({ openai }),
    );
    expect(events).toEqual([]);
    expect(calls).toBe(2);
  });

  it('stops immediately on a non-recoverable error without trying fallbacks', async () => {
    let calls = 0;
    const openai: CompleteFn = async () => {
      calls++;
      throw new ExtractError('bad_key', 'nope');
    };
    await expect(
      extractEvents(
        { ...ctx, provider: 'openai', apiKey: 'k', model: 'first', fallbackModels: ['second'] },
        fns({ openai }),
      ),
    ).rejects.toMatchObject({ code: 'bad_key' });
    expect(calls).toBe(1);
  });

  it('throws the last error when every model in the fallback chain fails', async () => {
    const openai: CompleteFn = async () => {
      throw new ExtractError('model_unavailable', 'nope');
    };
    await expect(
      extractEvents(
        { ...ctx, provider: 'openai', apiKey: 'k', model: 'first', fallbackModels: ['second'] },
        fns({ openai }),
      ),
    ).rejects.toMatchObject({ code: 'model_unavailable' });
  });
});
