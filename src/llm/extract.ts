import type { CalendarEvent } from '../schema';
import { ExtractError, isRecoverableWithFallback } from './errors';
import { parseExtraction } from './parse';
import {
  PROVIDER_INFO,
  SHARED_GEMINI_MODEL,
  type CompleteFn,
  type Message,
  type Provider,
} from './providers/types';
import { buildUserMessage, SYSTEM_PROMPT, type PromptContext } from './prompt';

export interface ExtractOptions extends PromptContext {
  provider: Provider;
  apiKey: string;
  model: string;
  fallbackModels: string[];
  fetchImpl?: typeof fetch;
}

/** Runs one model to completion: first attempt, then one repair retry if the
 * response fails validation. Shared across every provider. */
async function runModel(
  complete: CompleteFn,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch | undefined,
  ctx: PromptContext,
): Promise<CalendarEvent[]> {
  const referenceYear = ctx.now.getFullYear();
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(ctx) },
  ];

  const t0 = performance.now();
  const first = await complete({ apiKey, model, fetchImpl }, messages);
  console.log(`tab-to-cal: first LLM call took ${Math.round(performance.now() - t0)}ms (model ${model})`);
  const firstResult = parseExtraction(first, referenceYear);
  if (firstResult.ok) return firstResult.events;

  // One repair attempt with the validation error fed back. Should be rare
  // now that parseExtraction normalizes common alternate date/time formats.
  console.warn('tab-to-cal: first response failed validation, retrying:', firstResult.error);
  messages.push(
    { role: 'assistant', content: first },
    {
      role: 'user',
      content: `That response was invalid: ${firstResult.error}. Reply again with only JSON matching the schema.`,
    },
  );
  const t1 = performance.now();
  const retryResult = parseExtraction(await complete({ apiKey, model, fetchImpl }, messages), referenceYear);
  console.log(`tab-to-cal: retry LLM call took ${Math.round(performance.now() - t1)}ms`);
  if (retryResult.ok) return retryResult.events;
  throw new ExtractError('invalid_output', 'The model returned unusable output. Try again or pick another model.');
}

export async function extractEvents(
  options: ExtractOptions,
  completeFns: Record<Provider, CompleteFn>,
): Promise<CalendarEvent[]> {
  const providerName = PROVIDER_INFO[options.provider].name;
  // Gemini alone has a no-signup default: an empty key means "use the
  // shared free proxy" rather than a missing setup, and it's pinned to one
  // model regardless of what's configured (the proxy only allows that model).
  const usingSharedGemini = options.provider === 'gemini' && !options.apiKey.trim();

  if (!usingSharedGemini && !options.apiKey.trim()) {
    throw new ExtractError('no_key', `Add your ${providerName} API key in the extension options.`);
  }

  const models = usingSharedGemini
    ? [SHARED_GEMINI_MODEL]
    : [options.model, ...options.fallbackModels].map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) {
    throw new ExtractError('no_key', `Set a model for ${providerName} in the extension options.`);
  }

  const complete = completeFns[options.provider];
  let lastError: ExtractError | undefined;

  for (const model of models) {
    try {
      return await runModel(complete, options.apiKey, model, options.fetchImpl, options);
    } catch (error) {
      if (!(error instanceof ExtractError)) throw error;
      lastError = error;
      if (!isRecoverableWithFallback(error.code)) throw error;
      console.warn(`tab-to-cal: model "${model}" failed (${error.code}), trying next fallback if any`);
    }
  }

  throw lastError ?? new ExtractError('api', 'No models configured.');
}
