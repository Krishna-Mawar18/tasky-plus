import type { RiskLevel } from './types';

export type AuditOutcome = 'success' | 'denied' | 'failed' | 'pending_approval' | 'cancelled';

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  tool: string;
  risk: RiskLevel;
  approvalRequired: boolean;
  approvalId?: string;
  workspaceId?: string;
  resourceIds: string[];
  affectedCount: number;
  outcome: AuditOutcome;
  /** Short, redacted detail. Never contains prompts, secrets or full documents. */
  detail?: string;
}

/**
 * In-memory audit trail for the current session.
 *
 * Deliberately not written to Firestore: that would need new security rules and
 * a new collection, and would risk a failed audit write obscuring a successful
 * mutation. It records only the minimum fields and never stores prompts, model
 * output, API keys or whole documents.
 */
export class AuditLog {
  private entries: AuditEntry[] = [];
  private counter = 0;

  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    this.counter += 1;
    const full: AuditEntry = {
      ...entry,
      id: `audit-${this.counter}`,
      timestamp: Date.now(),
      detail: entry.detail ? entry.detail.slice(0, 300) : undefined,
      resourceIds: entry.resourceIds.slice(0, 100),
    };
    this.entries.push(full);
    if (this.entries.length > 500) this.entries = this.entries.slice(-500);
    return full;
  }

  list(): AuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.counter = 0;
  }
}
