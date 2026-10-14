import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateArguments } from '@/mark/tools/validate';
import { getToolDefinition } from '@/mark/tools/definitions';

const createTask = getToolDefinition('create_task')!.parameters;

test('accepts a well-formed argument object', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 'Fix login',
  });
  assert.equal(result.ok, true);
});

test('rejects a missing required property', () => {
  const result = validateArguments(createTask, { workspaceId: 'w1', boardId: 'b1', columnId: 'todo' });
  assert.equal(result.ok, false);
});

test('rejects a wrong type', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 42,
  });
  assert.equal(result.ok, false);
});

test('enforces enum values', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 'T',
    priority: 'urgent',
  });
  assert.equal(result.ok, false);
});

test('rejects an invalid array element', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 'T',
    tags: ['ok', 5],
  });
  assert.equal(result.ok, false);
});

test('rejects unexpected properties', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 'T',
    surprise: 'boo',
  });
  assert.equal(result.ok, false);
});

test('rejects non-object input', () => {
  assert.equal(validateArguments(createTask, []).ok, false);
  assert.equal(validateArguments(createTask, null).ok, false);
});

test('drops absent optional keys from the cleaned value', () => {
  const result = validateArguments(createTask, {
    workspaceId: 'w1',
    boardId: 'b1',
    columnId: 'todo',
    title: 'T',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(Object.keys(result.value).sort(), ['boardId', 'columnId', 'title', 'workspaceId']);
  }
});
