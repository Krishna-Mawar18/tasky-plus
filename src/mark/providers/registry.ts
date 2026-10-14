import { DEFAULT_PROVIDER_ID } from '@/mark/config';
import type { ProviderResult } from '@/mark/types';
import { ProviderError } from './errors';
import { createGroqProvider } from './groq';
import { createNvidiaProvider } from './nvidia';
import type { LLMProvider, ProviderChatRequest } from './types';

/**
 * All providers, primary first.
 *
 * The primary comes from `MARK_LLM_PROVIDER`. Every other provider acts as a
 * fallback, but only when it is actually configured. Provider order never
 * changes scope, tools, policy, or data access — only which endpoint answers.
 */
export function getProviderChain(): LLMProvider[] {
  const primary = (process.env.MARK_LLM_PROVIDER || DEFAULT_PROVIDER_ID).toLowerCase();
  const all = [createNvidiaProvider(), createGroqProvider()];
  const ordered = [...all].sort((a, b) => {
    if (a.id === primary) return -1;
    if (b.id === primary) return 1;
    return 0;
  });
  return ordered;
}

export function getConfiguredProviders(): LLMProvider[] {
  return getProviderChain().filter((provider) => provider.isConfigured());
}

export interface GenerateResult {
  result: ProviderResult;
  /** Providers tried before this one succeeded, in order. */
  attempted: string[];
}

/**
 * Bounded retry policy for transient provider failures.
 *
 * Hosted inference endpoints commonly return transient `5xx`/`429` responses
 * under load — the same request usually succeeds moments later. Without a
 * retry, a single blip fails the entire turn (the user sees "Mark could not
 * reach its model provider"), which is especially visible for multi-step turns
 * such as a move, where every tool round-trip is another chance to fail.
 *
 * Only `retryable` errors (timeout, rate limit, transient 5xx, unreachable) are
 * retried. Backoff is exponential with jitter so parallel callers do not
 * synchronize.
 */
const DEFAULT_MAX_ATTEMPTS = 3;
/** A timeout already burned its full budget; retry it once at most. */
const TIMEOUT_MAX_ATTEMPTS = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;

function maxAttempts(): number {
  const parsed = Number.parseInt(process.env.MARK_PROVIDER_MAX_ATTEMPTS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS;
}

function attemptLimit(error: ProviderError, attempts: number): number {
  return error.code === 'timeout' ? Math.min(TIMEOUT_MAX_ATTEMPTS, attempts) : attempts;
}

function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return exponential + Math.floor(Math.random() * (BASE_BACKOFF_MS / 2));
}

/** Sleep that resolves early if the caller's request is aborted. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProviderError('aborted', 'Provider call aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ProviderError('aborted', 'Provider call aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function toProviderError(error: unknown, providerId: string): ProviderError {
  return error instanceof ProviderError
    ? error
    : new ProviderError('unknown', 'Provider call failed', { providerId });
}

/**
 * Try each configured provider in turn, retrying transient failures.
 *
 * Only `retryable` failures (timeout, rate limit, transient 5xx, unreachable)
 * are retried, and exhausted providers move on to the next. A bad request or
 * malformed response stops immediately, because retrying would either repeat
 * the same mistake or mask a genuine defect. A non-idempotent
 * tool call is never retried here — this layer only generates text/tool
 * proposals, it does not execute anything.
 *
 * `providers` is injectable so tests can exercise the policy without network.
 */
export async function generateWithFallback(
  request: ProviderChatRequest,
  providers: LLMProvider[] = getConfiguredProviders(),
): Promise<GenerateResult> {
  if (providers.length === 0) {
    throw new ProviderError('not_configured', 'No Mark model provider is configured');
  }

  const attempts = maxAttempts();
  const attempted: string[] = [];
  let lastError: ProviderError | null = null;

  for (const provider of providers) {
    attempted.push(provider.id);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (request.signal?.aborted) {
        throw new ProviderError('aborted', 'Provider call aborted', { providerId: provider.id });
      }

      try {
        const result = await provider.chat(request);
        return { result, attempted };
      } catch (error) {
        const providerError = toProviderError(error, provider.id);
        lastError = providerError;

        // A bad request or malformed response is a genuine defect: retrying
        // would repeat the mistake, and falling back would mask it. Stop.
        if (!providerError.retryable) throw providerError;

        // Give up on this provider once it has exhausted its retries.
        if (attempt + 1 >= attemptLimit(providerError, attempts)) break;

        await delay(backoffDelay(attempt), request.signal);
      }
    }
  }

  throw lastError ?? new ProviderError('unknown', 'No provider produced a response');
}
