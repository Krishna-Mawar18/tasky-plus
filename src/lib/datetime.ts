/**
 * Date formatting for the task modal and the archived list.
 *
 * Kept in one place so a comment, an attachment and an archive entry all read
 * the same way. The comment timestamp format matches the brief's example
 * (`Oct 1, 10:32 AM`).
 */

/** `Oct 1, 10:32 AM` — used for comment timestamps. */
export function formatTimestamp(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** `Oct 1, 2026` — used for archive and attachment dates. */
export function formatDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** The sign-in user's display name, with sensible fallbacks. */
export function displayName(
  user: { displayName: string | null; email: string | null } | null | undefined,
): string {
  if (!user) return 'Unknown user';
  return user.displayName || user.email || 'Unknown user';
}