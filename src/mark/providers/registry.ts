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
 * Try each configured provider in turn.
 *
 * Only `retryable` failures (timeout, rate limit, transient 5xx, unreachable)
 * move on to the next provider. A bad request or malformed response stops
 * immediately, because a fallback would either repeat the same mistake or mask a
 * genuine defect. A non-idempotent tool call is never retried here — this layer
 * only generates text/tool proposals, it does not execute anything.
 */
export async function generateWithFallback(request: ProviderChatRequest): Promise<GenerateResult> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new ProviderError('not_configured', 'No Mark model provider is configured');
  }

  const attempted: string[] = [];
  let lastError: ProviderError | null = null;

  for (const provider of providers) {
    attempted.push(provider.id);
    try {
      const result = await provider.chat(request);
      return { result, attempted };
    } catch (error) {
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError('unknown', 'Provider call failed', { providerId: provider.id });
      lastError = providerError;
      if (!providerError.retryable) break;
    }
  }

  throw lastError ?? new ProviderError('unknown', 'No provider produced a response');
}
