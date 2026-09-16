import { completeAnthropic } from './anthropic';
import { completeGemini } from './gemini';
import { completeOpenAI } from './openai';
import { completeOpenRouter } from './openrouter';
import type { CompleteFn, Provider } from './types';

export const COMPLETE_FNS: Record<Provider, CompleteFn> = {
  openrouter: completeOpenRouter,
  openai: completeOpenAI,
  anthropic: completeAnthropic,
  gemini: completeGemini,
};

export * from './types';
