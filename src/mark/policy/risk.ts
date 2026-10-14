import { MARK_LIMITS } from '@/mark/config';
import type { RiskLevel } from '@/mark/types';
import { getToolDefinition } from '@/mark/tools/definitions';

export interface RiskAssessment {
  level: RiskLevel;
  requiresApproval: boolean;
  reasons: string[];
  /** Number of resources the operation is expected to affect. */
  affectedCount: number;
}

/**
 * Deterministic risk classification.
 *
 * The base level comes from the catalog. Runtime factors can only ever raise it:
 * a bulk operation crossing the configured thresholds needs approval, and one
 * crossing the high-risk threshold is treated as destructive. The model can
 * neither lower a level nor ask for approval to be skipped.
 */
export function assessRisk(toolName: string, affectedCount: number): RiskAssessment {
  const definition = getToolDefinition(toolName);
  const reasons: string[] = [];
  let level: RiskLevel = definition?.risk ?? 'destructive';

  if (!definition) {
    return { level: 'destructive', requiresApproval: true, reasons: ['unknown tool'], affectedCount };
  }

  let requiresApproval = level === 'destructive';
  if (level === 'destructive') reasons.push('permanently removes data');

  if (affectedCount > MARK_LIMITS.highRiskThreshold) {
    level = 'destructive';
    requiresApproval = true;
    reasons.push(`affects ${affectedCount} resources, above the high-risk threshold`);
  } else if (affectedCount > MARK_LIMITS.bulkThreshold) {
    requiresApproval = true;
    reasons.push(`affects ${affectedCount} resources, above the bulk threshold`);
  }

  if (affectedCount > MARK_LIMITS.maxResourcesPerOperation) {
    requiresApproval = true;
    reasons.push(`affects more than the allowed ${MARK_LIMITS.maxResourcesPerOperation} resources`);
  }

  return { level, requiresApproval, reasons, affectedCount };
}
