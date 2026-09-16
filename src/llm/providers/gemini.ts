import { extractionJsonSchema } from '../../schema';
import { ExtractError } from '../errors';
import { toGeminiSchema } from './gemini-schema';
import { SHARED_GEMINI_PROXY_URL, type CompleteFn } from './types';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const completeGemini: CompleteFn = async (options, messages) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const usingSharedProxy = !options.apiKey.trim();

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  // Gemini calls the assistant role "model", not "assistant".
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const geminiBody = {
    contents,
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(extractionJsonSchema),
    },
  };

  // Direct call sends the real key and puts the model in the URL. The shared
  // proxy holds its own key server-side, so the model goes in the body
  // instead, and it's validated there against a small allowlist.
  const endpoint = usingSharedProxy
    ? SHARED_GEMINI_PROXY_URL
    : `${GEMINI_ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!usingSharedProxy) headers['x-goog-api-key'] = options.apiKey.trim();
  const body = usingSharedProxy ? { model: options.model, ...geminiBody } : geminiBody;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new ExtractError(
      'network',
      usingSharedProxy ? 'Could not reach the shared Gemini proxy. Check your connection.' : 'Could not reach Gemini. Check your connection.',
    );
  }

  const responseBody = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: number };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;

  if (!response.ok || responseBody?.error) {
    throw toExtractError(response.status, responseBody?.error?.message, usingSharedProxy);
  }

  const text = responseBody?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new ExtractError('invalid_output', 'The model returned an empty response. Try again.');
  return text;
};

function toExtractError(status: number, message = '', usingSharedProxy: boolean): ExtractError {
  if (usingSharedProxy && status === 429) {
    return new ExtractError(
      'shared_quota_exhausted',
      "We're experiencing high demand on the free shared tier right now. Try again in a bit, or add your own free Gemini API key in the options to skip this limit.",
    );
  }
  switch (status) {
    case 401:
    case 403:
      return new ExtractError('bad_key', 'Gemini rejected your API key. Check it in the options.');
    case 429:
      return new ExtractError('rate_limited', 'Gemini rate-limited this request. Try again later.');
    case 404:
      return new ExtractError('model_unavailable', 'That model id was not found. Check it in the options.');
    default:
      return new ExtractError('api', `Gemini error${status ? ` ${status}` : ''}: ${message || 'unknown error'}`);
  }
}
