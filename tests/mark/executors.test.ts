import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeTool } from '@/mark/tools/executors';
import type { ToolUser } from '@/mark/tools/types';

const USER: ToolUser = { uid: 'u1', displayName: 'Ada', email: 'ada@example.com' };

test('get_current_user reports the identity from the execution context, not the model', async () => {
  // RBAC-03: the model previously had no trusted way to learn who it was acting
  // as. The identity must come from the verified session (`ctx.user`), so it can
  // never be spoofed by a tool argument. No workspace id means no Firestore read.
  const result = await executeTool('get_current_user', {}, { user: USER, now: new Date() });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { uid: 'u1', displayName: 'Ada', email: 'ada@example.com' });
});

test('get_current_user ignores any caller-supplied identity in its arguments', async () => {
  const result = await executeTool(
    'get_current_user',
    { uid: 'attacker', role: 'owner' },
    { user: USER, now: new Date() },
  );

  assert.equal(result.ok, true);
  assert.equal((result.data as { uid: string }).uid, 'u1');
});
