import type { ProviderMessage, ProviderResult, ProviderToolCall, ProposedToolCall } from '@/mark/types';
import { ProviderError, codeFromStatus } from './errors';
import type { LLMProvider, ProviderChatRequest } from './types';

export interface OpenAICompatibleOptions {
  id: string;
  /** Base URL including `/v1`, e.g. `https://integrate.api.nvidia.com/v1`. */
  apiBase: string;
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
}

interface RawToolCall {
  id?: unknown;
  function?: { name?: unknown; arguments?: unknown };
}

interface RawChoice {
  message?: { content?: unknown; tool_calls?: unknown };
  finish_reason?: unknown;
}

/**
 * NVIDIA and Groq both expose an OpenAI-compatible `/chat/completions` endpoint,
 * so the transport lives in one place and each provider only supplies its
 * endpoint, key, model, and timeout.
 */
export function createOpenAICompatibleProvider(options: OpenAICompatibleOptions): LLMProvider {
  const { id, apiBase, apiKey, model, timeoutMs } = options;

  return {
    id,
    model,
    isConfigured: () => typeof apiKey === 'string' && apiKey.trim().length > 0,

    async chat(request: ProviderChatRequest): Promise<ProviderResult> {
      if (!this.isConfigured()) {
        throw new ProviderError('not_configured', `${id} is not configured`, { providerId: id });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onExternalAbort, { once: true });

      let response: Response;
      try {
        response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            tools: request.tools.length > 0 ? request.tools : undefined,
            tool_choice: request.tools.length > 0 ? 'auto' : undefined,
            temperature: request.temperature ?? 0.2,
            max_tokens: request.maxTokens,
            stream: false,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          throw new ProviderError('timeout', `${id} request timed out`, { providerId: id });
        }
        throw new ProviderError('unavailable', `${id} could not be reached`, { providerId: id });
      } finally {
        clearTimeout(timeout);
        request.signal?.removeEventListener('abort', onExternalAbort);
      }

      if (!response.ok) {
        const code = codeFromStatus(response.status);
        throw new ProviderError(code, `${id} responded with status ${response.status}`, {
          status: response.status,
          providerId: id,
        });
      }

      let payload: { choices?: unknown; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
      try {
        payload = await response.json();
      } catch {
        throw new ProviderError('malformed_response', `${id} returned a non-JSON response`, { providerId: id });
      }

      const choices = Array.isArray(payload.choices) ? (payload.choices as RawChoice[]) : [];
      const choice = choices[0];
      if (!choice?.message) {
        throw new ProviderError('malformed_response', `${id} returned no completion`, { providerId: id });
      }

      const content = typeof choice.message.content === 'string' ? choice.message.content : null;
      const rawToolCalls = Array.isArray(choice.message.tool_calls)
        ? (choice.message.tool_calls as RawToolCall[])
        : [];

      const toolCalls: ProposedToolCall[] = [];
      const echoToolCalls: ProviderToolCall[] = [];

      rawToolCalls.forEach((raw, index) => {
        const name = typeof raw?.function?.name === 'string' ? raw.function.name : '';
        if (!name) return;
        const rawArguments = typeof raw.function?.arguments === 'string' ? raw.function.arguments : '{}';
        const toolCallId = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `${id}-call-${index}`;

        let parsed: Record<string, unknown> = {};
        let parseError = false;
        try {
          const candidate = rawArguments.trim().length === 0 ? {} : JSON.parse(rawArguments);
          if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            parsed = candidate as Record<string, unknown>;
          } else {
            parseError = true;
          }
        } catch {
          parseError = true;
        }

        toolCalls.push({ id: toolCallId, name, arguments: parsed, rawArguments, parseError });
        echoToolCalls.push({ id: toolCallId, type: 'function', function: { name, arguments: rawArguments } });
      });

      const rawAssistant: ProviderMessage = {
        role: 'assistant',
        content,
        ...(echoToolCalls.length > 0 ? { tool_calls: echoToolCalls } : {}),
      };

      return {
        provider: id,
        model,
        text: content,
        toolCalls,
        finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
        usage: payload.usage
          ? {
              promptTokens: typeof payload.usage.prompt_tokens === 'number' ? payload.usage.prompt_tokens : undefined,
              completionTokens:
                typeof payload.usage.completion_tokens === 'number' ? payload.usage.completion_tokens : undefined,
            }
          : undefined,
        rawAssistant,
      };
    },
  };
}
