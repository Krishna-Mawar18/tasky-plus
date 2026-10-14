export interface ToolUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

export interface ToolExecutionContext {
  user: ToolUser;
  now: Date;
}

export interface ToolExecutionResult {
  ok: boolean;
  /** Compact, structured data for the model. Never a whole Firestore document. */
  data?: unknown;
  /** Short human-readable summary for the activity feed / audit. */
  summary: string;
  /** Safe, user-facing error message when `ok` is false. */
  error?: string;
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

/** Small typed accessors for validated arguments. */
export function asString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value : '';
}

export function asOptionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

export function asStringArray(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function asOptionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
