/**
 * Client-safe Mark configuration.
 *
 * Deliberately contains NO secrets and reads NO environment variables: anything
 * here ships in the browser bundle. Provider keys are read only inside the
 * server route (`src/app/api/mark/route.ts`) via `src/mark/providers`.
 *
 * The values below are the documented defaults. They can be overridden on the
 * server through `MARK_*` environment variables, which the route honors for its
 * own limits; the client uses these constants for the same policy decisions so
 * that approvals and bulk previews behave predictably in the UI.
 */

export interface MarkLimits {
  /** An approval is only valid for this long after it is issued. */
  approvalTtlMinutes: number;
  /** Maximum model<->tool round trips for a single user turn. */
  maxToolSteps: number;
  /** Ceiling on the transcript size sent to the provider, in characters. */
  maxContextChars: number;
  /** Above this many affected resources, an operation needs an explicit preview. */
  bulkThreshold: number;
  /** Above this many affected resources, an operation is treated as high risk. */
  highRiskThreshold: number;
  /** Hard cap on resources a single approved operation may touch. */
  maxResourcesPerOperation: number;
  /** Whether tool denial reasons may be surfaced verbatim to the user. */
  exposeDenials: boolean;
}

export const MARK_LIMITS: MarkLimits = {
  approvalTtlMinutes: 5,
  maxToolSteps: 8,
  maxContextChars: 60000,
  bulkThreshold: 5,
  highRiskThreshold: 25,
  maxResourcesPerOperation: 200,
  exposeDenials: false,
};

/** Default provider when none is chosen. Matches `MARK_LLM_PROVIDER`. */
export const DEFAULT_PROVIDER_ID = 'nvidia';
