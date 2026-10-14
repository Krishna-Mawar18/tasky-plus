import { createOpenAICompatibleProvider } from './openaiCompatible';
import type { LLMProvider } from './types';

export const GROQ_DEFAULT_API_BASE = 'https://api.groq.com/openai/v1';
export const GROQ_DEFAULT_MODEL = 'qwen/qwen3.8-27b';

/**
 * Server-only. Reads `GROQ_*` from the environment; the key is never sent to the
 * browser. Built lazily so importing this module never requires a key.
 */
export function createGroqProvider(): LLMProvider {
  const timeout = Number(process.env.GROQ_TIMEOUT_MS);
  return createOpenAICompatibleProvider({
    id: 'groq',
    apiBase: process.env.GROQ_API_BASE || GROQ_DEFAULT_API_BASE,
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
  });
}
