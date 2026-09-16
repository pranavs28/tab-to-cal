export type Provider = 'openrouter' | 'openai' | 'anthropic' | 'gemini';

export const PROVIDERS: readonly Provider[] = ['openrouter', 'openai', 'anthropic', 'gemini'];

export interface ProviderLabel {
  name: string;
  keyHint: string;
  keyUrl: string;
  defaultModel: string;
  modelHint: string;
}

export const PROVIDER_INFO: Record<Provider, ProviderLabel> = {
  openrouter: {
    name: 'OpenRouter',
    keyHint: 'Routes to many models, including free ones. Good for trying this out at no cost.',
    keyUrl: 'https://openrouter.ai/keys',
    defaultModel: 'nex-agi/nex-n2.5-mini:free',
    modelHint: 'Any OpenRouter model id that supports structured outputs, e.g. a ":free" model.',
  },
  openai: {
    name: 'OpenAI',
    keyHint: 'Uses your own OpenAI account and billing.',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-5.6-luna',
    modelHint: 'Any current OpenAI model id that supports Structured Outputs.',
  },
  anthropic: {
    name: 'Claude (Anthropic)',
    keyHint: 'Uses your own Anthropic account and billing.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-4-5-20251001',
    modelHint: 'Any current Claude model id.',
  },
  gemini: {
    name: 'Gemini (Google)',
    keyHint: 'Google AI Studio gives free-tier API keys for personal use.',
    keyUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-3.5-flash-lite',
    modelHint: 'Any current Gemini model id.',
  },
};

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

/** One provider's job: take the conversation so far and return the raw text
 * response. All parsing, normalization, schema validation and repair-retry
 * logic lives above this, in src/llm/extract.ts, so every provider shares it. */
export type CompleteFn = (options: CompleteOptions, messages: Message[]) => Promise<string>;
