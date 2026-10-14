import { createOpenAICompatibleProvider } from './openaiCompatible';
import type { LLMProvider } from './types';

export const NVIDIA_DEFAULT_API_BASE = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

/**
 * Server-only. Reads `NVIDIA_*` from the environment; the key is never sent to
 * the browser. Built lazily so importing this module never requires a key.
 */
export function createNvidiaProvider(): LLMProvider {
  const timeout = Number(process.env.NVIDIA_TIMEOUT_MS);
  return createOpenAICompatibleProvider({
    id: 'nvidia',
    apiBase: process.env.NVIDIA_API_BASE || NVIDIA_DEFAULT_API_BASE,
    apiKey: process.env.NVIDIA_API_KEY,
    model: process.env.NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
  });
}
