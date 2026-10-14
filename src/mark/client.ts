import type { MarkChatResponse, MarkStatusResponse } from './protocol';
import type { ProviderMessage } from './types';

export interface MarkClient {
  chat(messages: ProviderMessage[]): Promise<MarkChatResponse>;
  status(): Promise<MarkStatusResponse | { ok: false }>;
}

/**
 * The browser side of the proxy.
 *
 * It never sees a provider key — it only attaches the caller's Firebase ID token
 * and forwards conversation turns. Every failure is normalized so the UI always
 * has something safe to render.
 */
export function createMarkClient(getIdToken: () => Promise<string | null>): MarkClient {
  async function authHeaders(): Promise<Record<string, string>> {
    let token: string | null = null;
    try {
      token = await getIdToken();
    } catch {
      token = null;
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  return {
    async chat(messages: ProviderMessage[]): Promise<MarkChatResponse> {
      try {
        const response = await fetch('/api/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ messages }),
        });
        const payload = (await response.json()) as MarkChatResponse;
        if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
          return { ok: false, error: { code: 'bad_response', message: 'Mark returned an unexpected response.' } };
        }
        return payload;
      } catch {
        return { ok: false, error: { code: 'network', message: 'Mark could not be reached. Check your connection.' } };
      }
    },

    async status(): Promise<MarkStatusResponse | { ok: false }> {
      try {
        const response = await fetch('/api/mark', { headers: await authHeaders() });
        if (!response.ok) return { ok: false };
        return (await response.json()) as MarkStatusResponse;
      } catch {
        return { ok: false };
      }
    },
  };
}
