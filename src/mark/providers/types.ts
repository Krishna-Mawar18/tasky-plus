import type { MarkToolDefinition, ProviderMessage, ProviderResult, ProviderToolSchema } from '@/mark/types';

/** A provider call, already fully assembled by the server route. */
export interface ProviderChatRequest {
  /** Does NOT include the system prompt; the route prepends that itself. */
  messages: ProviderMessage[];
  tools: ProviderToolSchema[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * The single provider interface.
 *
 * Every concrete provider (NVIDIA, Groq) implements exactly this, so switching
 * or falling back never changes scope, policy, or data access — only which
 * endpoint answers.
 */
export interface LLMProvider {
  readonly id: string;
  readonly model: string;
  /** Whether an API key for this provider is present server-side. */
  isConfigured(): boolean;
  chat(request: ProviderChatRequest): Promise<ProviderResult>;
}

/** Build the provider-facing tool schemas from the server-owned catalog. */
export function toProviderToolSchemas(definitions: readonly MarkToolDefinition[]): ProviderToolSchema[] {
  return definitions.map((definition) => ({
    type: 'function',
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
    },
  }));
}
