import { NextResponse } from 'next/server';
import { MARK_LIMITS } from '@/mark/config';
import { MARK_SYSTEM_PROMPT } from '@/mark/prompts/systemPrompt';
import { ProviderError } from '@/mark/providers/errors';
import { generateWithFallback, getConfiguredProviders } from '@/mark/providers/registry';
import type { ProviderMessage } from '@/mark/types';
import { toProviderToolSchemas } from '@/mark/providers/types';
import { verifyBearerToken } from '@/mark/server/auth';
import { MARK_TOOL_DEFINITIONS } from '@/mark/tools/definitions';
import type { MarkChatRequestBody, MarkChatResponse, MarkErrorBody, MarkStatusResponse } from '@/mark/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['user', 'assistant', 'tool']);
const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 20000;

function maxContextChars(): number {
  const value = Number(process.env.MARK_MAX_CONTEXT_CHARS);
  return Number.isFinite(value) && value > 0 ? value : MARK_LIMITS.maxContextChars;
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<MarkErrorBody>({ ok: false, error: { code, message } }, { status });
}

/** Reject anything that is not one of our own conversation turns. */
function sanitizeMessages(input: unknown): ProviderMessage[] {
  if (!Array.isArray(input)) throw new Error('messages must be an array');
  if (input.length === 0) throw new Error('messages must not be empty');
  if (input.length > MAX_MESSAGES) throw new Error('too many messages');

  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`message ${index} is not an object`);
    const message = raw as Record<string, unknown>;
    const role = message.role;
    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
      // A client-supplied `system` turn is refused outright so the system prompt
      // cannot be replaced or extended from the browser.
      throw new Error(`message ${index} has a disallowed role`);
    }
    const content = message.content;
    if (content !== null && typeof content !== 'string') throw new Error(`message ${index} has invalid content`);
    if (typeof content === 'string' && content.length > MAX_MESSAGE_CHARS) {
      throw new Error(`message ${index} is too large`);
    }
    if (role === 'tool' && (typeof message.tool_call_id !== 'string' || message.tool_call_id.length === 0)) {
      throw new Error(`tool message ${index} is missing tool_call_id`);
    }
    return message as unknown as ProviderMessage;
  });
}

export async function POST(request: Request) {
  const auth = await verifyBearerToken(request);
  if (!auth.ok) {
    return errorResponse(401, 'unauthorized', 'Sign in is required to use Mark.');
  }

  let body: MarkChatRequestBody;
  try {
    const raw = await request.text();
    if (raw.length > maxContextChars() * 2) {
      return errorResponse(413, 'payload_too_large', 'That request is too large for Mark.');
    }
    body = JSON.parse(raw) as MarkChatRequestBody;
  } catch {
    return errorResponse(400, 'bad_request', 'The request could not be parsed.');
  }

  let messages: ProviderMessage[];
  try {
    messages = sanitizeMessages(body?.messages);
  } catch (error) {
    return errorResponse(400, 'bad_request', (error as Error).message);
  }

  const transcript: ProviderMessage[] = [{ role: 'system', content: MARK_SYSTEM_PROMPT }, ...messages];
  if (JSON.stringify(transcript).length > maxContextChars()) {
    return errorResponse(413, 'context_too_large', 'This conversation is too long for Mark. Start a new one.');
  }

  const tools = toProviderToolSchemas(MARK_TOOL_DEFINITIONS);

  try {
    const { result, attempted } = await generateWithFallback({ messages: transcript, tools });
    const payload: MarkChatResponse = {
      ok: true,
      provider: result.provider,
      model: result.model,
      attempted,
      text: result.text,
      toolCalls: result.toolCalls,
      finishReason: result.finishReason,
      rawAssistant: result.rawAssistant,
    };
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === 'not_configured' ? 503 : error.code === 'rate_limited' ? 429 : 502;
      return errorResponse(status, error.code, 'Mark could not reach its model provider. Please try again.');
    }
    console.error('Mark provider call failed:', error);
    return errorResponse(500, 'unknown', 'Mark ran into an unexpected problem.');
  }
}

export async function GET(request: Request) {
  const auth = await verifyBearerToken(request);
  if (!auth.ok) {
    return errorResponse(401, 'unauthorized', 'Sign in is required to use Mark.');
  }
  const payload: MarkStatusResponse = {
    ok: true,
    configured: getConfiguredProviders().length > 0,
    providers: getConfiguredProviders().map((provider) => provider.id),
  };
  return NextResponse.json(payload);
}
