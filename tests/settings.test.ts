import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, activeProviderSettings, getSettings, saveSettings } from '../src/settings';
import { PROVIDER_INFO } from '../src/llm/providers/types';

function fakeChromeStorage(initial: Record<string, unknown> = {}) {
  let store = { ...initial };
  return {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (value: Record<string, unknown>) => {
        store = { ...store, ...value };
      }),
    },
  };
}

describe('getSettings', () => {
  beforeEach(() => {
    (globalThis as any).chrome = { storage: fakeChromeStorage() };
  });

  it('returns defaults with nothing stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates a pre-multi-provider flat settings object into providers.openrouter', async () => {
    (globalThis as any).chrome = {
      storage: fakeChromeStorage({
        settings: { apiKey: 'sk-or-old', model: 'some/model:free', fallbackModels: ['a', 'b'], accountEmail: 'me@x.com' },
      }),
    };
    const settings = await getSettings();
    expect(settings.provider).toBe('openrouter');
    expect(settings.providers.openrouter).toEqual({
      apiKey: 'sk-or-old',
      model: 'some/model:free',
      fallbackModels: ['a', 'b'],
    });
    expect(settings.accountEmail).toBe('me@x.com');
    // Other providers still get sensible defaults, not blanked out.
    expect(settings.providers.openai.model).toBe(PROVIDER_INFO.openai.defaultModel);
  });

  it('round-trips a saved multi-provider settings object', async () => {
    const toSave = {
      ...DEFAULT_SETTINGS,
      provider: 'anthropic' as const,
      providers: {
        ...DEFAULT_SETTINGS.providers,
        anthropic: { apiKey: 'sk-ant-x', model: 'claude-haiku-4-5-20251001', fallbackModels: [] },
      },
    };
    await saveSettings(toSave);
    const loaded = await getSettings();
    expect(loaded).toEqual(toSave);
    expect(activeProviderSettings(loaded).apiKey).toBe('sk-ant-x');
  });
});
