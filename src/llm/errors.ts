export type ExtractErrorCode =
  | 'no_key'
  | 'bad_key'
  | 'rate_limited'
  | 'no_credits'
  | 'model_unavailable'
  | 'invalid_output'
  | 'network'
  | 'api';

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
