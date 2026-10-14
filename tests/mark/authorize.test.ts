import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeTool } from '@/mark/policy/authorize';

test('viewers cannot perform task or board writes', () => {
  assert.equal(authorizeTool('create_task', 'viewer').allowed, false);
  assert.equal(authorizeTool('delete_board', 'viewer').allowed, false);
  assert.equal(authorizeTool('update_workspace', 'viewer').allowed, false);
});

test('managers can manage boards and tasks but not the workspace or members', () => {
  assert.equal(authorizeTool('create_board', 'manager').allowed, true);
  assert.equal(authorizeTool('delete_task', 'manager').allowed, true);
  assert.equal(authorizeTool('update_workspace', 'manager').allowed, false);
  assert.equal(authorizeTool('delete_workspace', 'manager').allowed, false);
});

test('owners may do everything a manager may, plus workspace administration', () => {
  assert.equal(authorizeTool('update_workspace', 'owner').allowed, true);
  assert.equal(authorizeTool('delete_workspace', 'owner').allowed, true);
});

test('viewers may read and comment but not clear up after others', () => {
  assert.equal(authorizeTool('list_tasks', 'viewer').allowed, true);
  assert.equal(authorizeTool('create_comment', 'viewer').allowed, true);
  assert.equal(authorizeTool('delete_comment', 'viewer').allowed, true);
});

test('workspace-agnostic tools are allowed for any signed-in user', () => {
  assert.equal(authorizeTool('list_workspaces', null).allowed, true);
  assert.equal(authorizeTool('create_workspace', null).allowed, true);
});

test('workspace-scoped tools are denied without a role', () => {
  assert.equal(authorizeTool('list_tasks', null).allowed, false);
});

test('unknown tools are denied', () => {
  assert.equal(authorizeTool('rm_rf', 'owner').allowed, false);
});
