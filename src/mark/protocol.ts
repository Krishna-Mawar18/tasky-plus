import type { ProviderMessage, ProposedToolCall } from '@/mark/types';

/**
 * Wire contract between the browser orchestrator and the `/api/mark` route.
 *
 * The client sends only conversation turns (never a system prompt, never tool
 * schemas); the server owns the system prompt, the tool catalog, the provider
 * keys and the limits.
 */
export interface MarkChatRequestBody {
  /** Turns with roles `user`, `assistant` or `tool`. A `system` turn is rejected. */
  messages: ProviderMessage[];
}

export interface MarkChatSuccess {
  ok: true;
  provider: string;
  model: string;
  /** Providers tried before this one answered, in order. */
  attempted: string[];
  text: string | null;
  toolCalls: ProposedToolCall[];
  finishReason: string | null;
  /** The assistant turn to append to the transcript before tool results. */
  rawAssistant: ProviderMessage;
}

export interface MarkErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface MarkStatusResponse {
  ok: true;
  configured: boolean;
  providers: string[];
}

export type MarkChatResponse = MarkChatSuccess | MarkErrorBody;
