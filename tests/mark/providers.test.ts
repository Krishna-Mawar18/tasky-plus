import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWithFallback } from '@/mark/providers/registry';
import { ProviderError } from '@/mark/providers/errors';
import type { LLMProvider, ProviderChatRequest } from '@/mark/providers/types';
import type { ProviderResult } from '@/mark/types';

// Keep retry timing short for tests; the policy itself is what is under test.
process.env.MARK_PROVIDER_MAX_ATTEMPTS = '2';

const request: ProviderChatRequest = { messages: [], tools: [] };

function okResult(provider: string): ProviderResult {
  return {
    provider,
    model: provider,
    text: 'ok',
    toolCalls: [],
    finishReason: 'stop',
    rawAssistant: { role: 'assistant', content: 'ok' },
  };
}

function fakeProvider(id: string, chat: LLMProvider['chat']): LLMProvider {
  return { id, model: id, isConfigured: () => true, chat };
}

test('retries a retryable provider failure before giving up', async () => {
  let calls = 0;
  const provider = fakeProvider('a', async () => {
    calls += 1;
    if (calls < 2) throw new ProviderError('unavailable', 'overloaded');
    return okResult('a');
  });

  const { result, attempted } = await generateWithFallback(request, [provider]);

  assert.equal(calls, 2);
  assert.equal(result.provider, 'a');
  assert.deepEqual(attempted, ['a']);
});

test('a non-retryable failure stops immediately and never falls back', async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const primary = fakeProvider('a', async () => {
    primaryCalls += 1;
    throw new ProviderError('bad_request', 'malformed tool schema');
  });
  const fallback = fakeProvider('b', async () => {
    fallbackCalls += 1;
    return okResult('b');
  });

  await assert.rejects(
    () => generateWithFallback(request, [primary, fallback]),
    (error: unknown) => error instanceof ProviderError && error.code === 'bad_request',
  );
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 0);
});

test('falls back to the next provider once the first exhausts its retries', async () => {
  let primaryCalls = 0;
  const primary = fakeProvider('a', async () => {
    primaryCalls += 1;
    throw new ProviderError('rate_limited', 'slow down');
  });
  const fallback = fakeProvider('b', async () => okResult('b'));

  const { result, attempted } = await generateWithFallback(request, [primary, fallback]);

  assert.equal(primaryCalls, 2);
  assert.equal(result.provider, 'b');
  assert.deepEqual(attempted, ['a', 'b']);
});

test('throws not_configured when no provider is available', async () => {
  await assert.rejects(
    () => generateWithFallback(request, []),
    (error: unknown) => error instanceof ProviderError && error.code === 'not_configured',
  );
});

test('does not call a provider once the request is aborted', async () => {
  let calls = 0;
  const provider = fakeProvider('a', async () => {
    calls += 1;
    return okResult('a');
  });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => generateWithFallback({ ...request, signal: controller.signal }, [provider]),
    (error: unknown) => error instanceof ProviderError && error.code === 'aborted',
  );
  assert.equal(calls, 0);
});
