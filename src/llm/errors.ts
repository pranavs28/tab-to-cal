export type ExtractErrorCode =
  | 'no_key'
  | 'bad_key'
  | 'rate_limited'
  | 'no_credits'
  | 'model_unavailable'
  | 'invalid_output'
  | 'network'
  | 'api'
  // Specifically the shared, no-signup-required Gemini default (used when
  // no personal key is set), distinct from `rate_limited` on a personal key.
  | 'shared_quota_exhausted';

export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}

/** Codes worth retrying with a different (fallback) model on the same provider. */
export function isRecoverableWithFallback(code: ExtractErrorCode): boolean {
  return code === 'rate_limited' || code === 'model_unavailable' || code === 'invalid_output' || code === 'api';
}
