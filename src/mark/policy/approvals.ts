import { MARK_LIMITS } from '@/mark/config';
import type { RiskLevel } from '@/mark/types';

export interface ApprovalAction {
  toolName: string;
  arguments: Record<string, unknown>;
  workspaceId: string | null;
  resourceIds: string[];
  risk: RiskLevel;
  affectedCount: number;
  /** Human-readable list of the exact resources that will be affected. */
  preview: string[];
  /** Observable consequences, referenced from the tool catalog only. */
  consequences: string[];
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface ApprovalRequest {
  id: string;
  userId: string;
  action: ApprovalAction;
  canonicalKey: string;
  createdAt: number;
  expiresAt: number;
  status: ApprovalStatus;
}

/** Deterministic JSON with sorted keys, so equal actions collide and others do not. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function canonicalKey(toolName: string, args: Record<string, unknown>): string {
  return stableStringify({ toolName, args });
}

/**
 * A client-side approval store bound to one authenticated user.
 *
 * The threat actor is the model, which cannot reach this object: approvals are
 * only created by the orchestrator and only consumed by an explicit UI action.
 * Every approval is bound to the user, the canonical tool + arguments, the
 * affected resource ids, the risk level and an expiry. Changing any material
 * argument or target produces a different canonical key, so an old approval can
 * never authorize a new action. Executions re-check authorization independently.
 */
export class ApprovalStore {
  private requests = new Map<string, ApprovalRequest>();
  private counter = 0;

  get ttlMs(): number {
    return MARK_LIMITS.approvalTtlMinutes * 60_000;
  }

  create(userId: string, action: ApprovalAction): ApprovalRequest {
    const key = canonicalKey(action.toolName, action.arguments);

    // Reuse an identical, still-valid pending request rather than stacking
    // duplicates for the same action.
    for (const existing of this.requests.values()) {
      if (
        existing.userId === userId &&
        existing.canonicalKey === key &&
        existing.status === 'pending' &&
        existing.expiresAt > Date.now()
      ) {
        return existing;
      }
    }

    this.counter += 1;
    const now = Date.now();
    const request: ApprovalRequest = {
      id: `approval-${this.counter}`,
      userId,
      action,
      canonicalKey: key,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      status: 'pending',
    };
    this.requests.set(request.id, request);
    return request;
  }

  get(id: string): ApprovalRequest | null {
    return this.requests.get(id) ?? null;
  }

  /**
   * Check a pending approval is still usable. Fails closed on anything: wrong
   * user, expired, already consumed, cancelled, or a canonical mismatch against
   * the operation the caller means to run.
   */
  validate(id: string, userId: string, expected: { toolName: string; arguments: Record<string, unknown> }): { ok: true; request: ApprovalRequest } | { ok: false; reason: string } {
    const request = this.requests.get(id);
    if (!request) return { ok: false, reason: 'This approval no longer exists.' };
    if (request.userId !== userId) return { ok: false, reason: 'This approval belongs to another user.' };
    if (request.status === 'consumed') return { ok: false, reason: 'This approval has already been used.' };
    if (request.status === 'rejected') {
      return { ok: false, reason: 'This approval was cancelled.' };
    }
    if (request.status === 'expired' || request.expiresAt <= Date.now()) {
      request.status = 'expired';
      return { ok: false, reason: 'This approval has expired. Please ask again.' };
    }
    if (request.canonicalKey !== canonicalKey(expected.toolName, expected.arguments)) {
      return { ok: false, reason: 'The operation changed since it was approved. Please ask again.' };
    }
    return { ok: true, request };
  }

  /** Mark an approval consumed. Single-use: a second attempt is refused. */
  consume(id: string): void {
    const request = this.requests.get(id);
    if (request) {
      request.status = 'consumed';
      this.requests.delete(id);
    }
  }

  cancel(id: string, userId: string): void {
    const request = this.requests.get(id);
    if (request && request.userId === userId && request.status === 'pending') {
      this.requests.delete(id);
    }
  }

  pendingFor(userId: string): ApprovalRequest[] {
    return [...this.requests.values()].filter(
      (request) => request.userId === userId && request.status === 'pending' && request.expiresAt > Date.now(),
    );
  }

  clear(): void {
    this.requests.clear();
    this.counter = 0;
  }
}
