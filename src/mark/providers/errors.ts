/**
 * Normalized provider failures.
 *
 * `retryable` is the only signal the fallback logic uses: a timeout, rate limit,
 * or transient 5xx may move to the other provider, while a bad request or a
 * malformed response must not (retrying would either repeat the same mistake or
 * hide a real bug).
 */
export type ProviderErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'bad_request'
  | 'unavailable'
  | 'malformed_response'
  | 'aborted'
  | 'unknown';

const RETRYABLE: readonly ProviderErrorCode[] = [
  'timeout',
  'rate_limited',
  'unavailable',
];

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status?: number;
  readonly providerId?: string;

  constructor(code: ProviderErrorCode, message: string, options?: { status?: number; providerId?: string }) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = options?.status;
    this.providerId = options?.providerId;
  }

  get retryable(): boolean {
    return RETRYABLE.includes(this.code);
  }
}

/** Map an HTTP status onto a normalized, non-secret-bearing error code. */
export function codeFromStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}
