import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalStore, canonicalKey } from '@/mark/policy/approvals';

function makeAction(toolName = 'delete_task', args: Record<string, unknown> = { taskId: 't1' }) {
  return {
    toolName,
    arguments: args,
    workspaceId: 'w1',
    resourceIds: ['t1'],
    risk: 'destructive' as const,
    affectedCount: 1,
    preview: ['Task: “X”'],
    consequences: ['gone'],
  };
}

test('a created approval validates for the same user and action', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction());
  const check = store.validate(request.id, 'u1', { toolName: 'delete_task', arguments: { taskId: 't1' } });
  assert.equal(check.ok, true);
});

test('an approval is bound to its user', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction());
  const check = store.validate(request.id, 'u2', { toolName: 'delete_task', arguments: { taskId: 't1' } });
  assert.equal(check.ok, false);
});

test('changing a material argument invalidates the approval', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction('delete_task', { taskId: 't1' }));
  const check = store.validate(request.id, 'u1', { toolName: 'delete_task', arguments: { taskId: 't2' } });
  assert.equal(check.ok, false);
});

test('an expired approval fails closed', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction());
  request.expiresAt = Date.now() - 1;
  const check = store.validate(request.id, 'u1', { toolName: 'delete_task', arguments: { taskId: 't1' } });
  assert.equal(check.ok, false);
});

test('an approval is single-use', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction());
  store.consume(request.id);
  const check = store.validate(request.id, 'u1', { toolName: 'delete_task', arguments: { taskId: 't1' } });
  assert.equal(check.ok, false);
});

test('cancelling removes the approval', () => {
  const store = new ApprovalStore();
  const request = store.create('u1', makeAction());
  store.cancel(request.id, 'u1');
  assert.equal(store.validate(request.id, 'u1', { toolName: 'delete_task', arguments: { taskId: 't1' } }).ok, false);
});

test('identical pending approvals are de-duplicated', () => {
  const store = new ApprovalStore();
  const first = store.create('u1', makeAction());
  const second = store.create('u1', makeAction());
  assert.equal(first.id, second.id);
});

test('canonical keys are order-independent but value-sensitive', () => {
  assert.equal(canonicalKey('t', { a: 1, b: 2 }), canonicalKey('t', { b: 2, a: 1 }));
  assert.notEqual(canonicalKey('t', { a: 1 }), canonicalKey('t', { a: 2 }));
});
