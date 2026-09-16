import { PROVIDER_INFO, PROVIDERS, type Provider } from './llm/providers/types';

export interface ProviderSettings {
  apiKey: string;
  model: string;
  fallbackModels: string[];
}

export interface Settings {
  provider: Provider;
  providers: Record<Provider, ProviderSettings>;
  accountEmail: string;
  privacyNoticeAcknowledged: boolean;
}

function defaultProviderSettings(provider: Provider): ProviderSettings {
  return { apiKey: '', model: PROVIDER_INFO[provider].defaultModel, fallbackModels: [] };
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openrouter',
  providers: Object.fromEntries(PROVIDERS.map((p) => [p, defaultProviderSettings(p)])) as Record<
    Provider,
    ProviderSettings
  >,
  accountEmail: '',
  privacyNoticeAcknowledged: false,
};

/** Pre-v0.2 settings had a single flat apiKey/model/fallbackModels, implicitly
 * OpenRouter (the only provider at the time). Fold those into the new
 * per-provider shape so an existing install doesn't lose its saved key. */
interface LegacyFlatSettings {
  apiKey?: string;
  model?: string;
  fallbackModels?: string[];
}

function migrate(stored: unknown): Partial<Settings> {
  if (!stored || typeof stored !== 'object') return {};
  const legacy = stored as Partial<Settings> & LegacyFlatSettings;
  if (legacy.providers) return legacy;
  if (!legacy.apiKey && !legacy.model && !legacy.fallbackModels) return legacy;
  const { apiKey, model, fallbackModels, ...rest } = legacy;
  return {
    ...rest,
    provider: 'openrouter',
    providers: {
      ...DEFAULT_SETTINGS.providers,
      openrouter: {
        apiKey: apiKey ?? '',
        model: model || PROVIDER_INFO.openrouter.defaultModel,
        fallbackModels: fallbackModels ?? [],
      },
    },
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  const migrated = migrate(stored.settings);
  return {
    ...DEFAULT_SETTINGS,
    ...migrated,
    providers: { ...DEFAULT_SETTINGS.providers, ...migrated.providers },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

/** The active provider's own settings, with its own key/model/fallbacks. */
export function activeProviderSettings(settings: Settings): ProviderSettings {
  return settings.providers[settings.provider];
}
