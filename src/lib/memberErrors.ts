/**
 * Typed member-management failures.
 *
 * Firestore error codes are mapped onto a small closed set of reasons so the UI
 * can show an accurate message instead of "something went wrong". Anything that
 * is not recognised is reported as `unknown` rather than being guessed at.
 */
export type MemberErrorCode =
  | 'not-signed-in'
  | 'firebase-not-configured'
  | 'not-a-member'
  | 'insufficient-permission'
  | 'owner-protected'
  | 'workspace-owner-mismatch'
  | 'invalid-email'
  | 'user-not-found'
  | 'already-member'
  | 'cannot-add-self'
  | 'membership-record-missing'
  | 'cannot-change-own-role'
  | 'invalid-role'
  | 'unknown';

const memberErrorMessages: Record<MemberErrorCode, string> = {
  'not-signed-in': 'You need to be signed in to manage members.',
  'firebase-not-configured': 'Firebase is not configured.',
  'not-a-member': 'You are not a member of this workspace.',
  'insufficient-permission': 'Your role does not allow this action.',
  'owner-protected': 'The workspace owner cannot be removed or changed.',
  'workspace-owner-mismatch': 'This membership is not the workspace owner.',
  'invalid-email': 'Enter a valid email address.',
  'user-not-found':
    'No Tasky account is registered with that exact email address. That person has to sign in to Tasky once with it before they can be added.',

  'already-member': 'That person is already a member of this workspace.',
  'cannot-add-self': 'That is your own email address — you are already a member of this workspace.',
  'membership-record-missing':
    'Your membership record for this workspace is missing, so the server cannot confirm your permissions. Open the workspace once more, or ask the owner to remove and re-add you.',
  'cannot-change-own-role': 'You cannot change your own role.',
  'invalid-role': 'That role is not available.',
  unknown: 'Something went wrong. Please try again.',
};

export class MemberOperationError extends Error {
  readonly code: MemberErrorCode;

  constructor(code: MemberErrorCode) {
    super(memberErrorMessages[code]);
    this.name = 'MemberOperationError';
    this.code = code;
  }
}

export function memberErrorMessage(code: MemberErrorCode): string {
  return memberErrorMessages[code];
}

function hasCode(error: unknown, code: string): boolean {
  return (error as { code?: string } | null)?.code === code;
}

/** `auth/...` or a missing auth object means the session expired. */
function isAuthError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return typeof code === 'string' && code.startsWith('auth/');
}

/**
 * Translate a thrown error into a `MemberErrorCode`.
 *
 * Order matters: the specific rule failures are checked before the generic
 * permission-denied case, because Firestore reports most of them as
 * `permission-denied` too.
 */
export function toMemberErrorCode(error: unknown): MemberErrorCode {
  if (error instanceof MemberOperationError) return error.code;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const code = (error as { code?: string } | null)?.code;

  if (isAuthError(error) || code === 'unauthenticated') return 'not-signed-in';
  if (hasCode(error, 'failed-precondition') || hasCode(error, 'unavailable')) return 'unknown';
  if (hasCode(error, 'not-found')) return 'user-not-found';

  if (code === 'permission-denied' || message.includes('permission-denied')) {
    if (message.includes('owner')) return 'owner-protected';
    return 'insufficient-permission';
  }

  return 'unknown';
}

/**
 * Human-readable text for any thrown value, so callers can toast directly.
 */
export function describeMemberError(error: unknown): string {
  return memberErrorMessage(toMemberErrorCode(error));
}
