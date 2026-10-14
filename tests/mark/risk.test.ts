import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '@/mark/policy/risk';
import { MARK_LIMITS } from '@/mark/config';

test('read tools never require approval', () => {
  const risk = assessRisk('list_workspaces', 1);
  assert.equal(risk.level, 'read');
  assert.equal(risk.requiresApproval, false);
});

test('destructive tools always require approval', () => {
  const risk = assessRisk('delete_task', 1);
  assert.equal(risk.level, 'destructive');
  assert.equal(risk.requiresApproval, true);
});

test('bulk normal-write tools require approval only above the bulk threshold', () => {
  assert.equal(assessRisk('bulk_archive_tasks', MARK_LIMITS.bulkThreshold).requiresApproval, false);
  const above = assessRisk('bulk_archive_tasks', MARK_LIMITS.bulkThreshold + 1);
  assert.equal(above.requiresApproval, true);
  assert.equal(above.level, 'normal_write');
});

test('crossing the high-risk threshold escalates to destructive', () => {
  const risk = assessRisk('bulk_archive_tasks', MARK_LIMITS.highRiskThreshold + 1);
  assert.equal(risk.level, 'destructive');
  assert.equal(risk.requiresApproval, true);
});

test('an unknown tool is treated as destructive and gated', () => {
  const risk = assessRisk('exfiltrate_everything', 1);
  assert.equal(risk.level, 'destructive');
  assert.equal(risk.requiresApproval, true);
});

test('operations beyond the resource cap always require approval', () => {
  const risk = assessRisk('bulk_archive_tasks', MARK_LIMITS.maxResourcesPerOperation + 1);
  assert.equal(risk.requiresApproval, true);
});
