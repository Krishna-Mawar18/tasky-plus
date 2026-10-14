/**
 * Shared Mark types.
 *
 * Nothing in this file touches Firebase, the DOM, or provider credentials, so it
 * is safe to import from both the browser (the orchestrator) and the server
 * (the `/api/mark` proxy).
 */

/** How dangerous a tool is. Decided server-side by the catalog, never the model. */
export type RiskLevel = 'read' | 'normal_write' | 'destructive';

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minimum?: number;
  maximum?: number;
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * A single tool Mark may propose.
 *
 * `risk` and `mutating` are part of the catalog, not the model's output: the
 * model only ever names a tool and supplies arguments.
 */
export interface MarkToolDefinition {
  name: string;
  description: string;
  risk: RiskLevel;
  mutating: boolean;
  parameters: JsonSchemaObject;
}

/** OpenAI-compatible function tool schema sent to the provider. */
export interface ProviderToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchemaObject;
  };
}

export type ProviderRole = 'system' | 'user' | 'assistant' | 'tool';

/** The assistant's raw function call, as returned by the provider. */
export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** Raw JSON string. Parsed and validated locally before it is trusted. */
    arguments: string;
  };
}

export interface ProviderMessage {
  role: ProviderRole;
  content: string | null;
  tool_calls?: ProviderToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** A tool call after local parsing. `parseError` means the arguments were not JSON. */
export interface ProposedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments: string;
  parseError: boolean;
}

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface ProviderResult {
  provider: string;
  model: string;
  text: string | null;
  toolCalls: ProposedToolCall[];
  finishReason: string | null;
  usage?: ProviderUsage;
  /** The assistant turn to append to the transcript before tool results. */
  rawAssistant: ProviderMessage;
}
