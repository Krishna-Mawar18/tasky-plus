/**
 * Link rules, in one place so the browser, the service and the Firestore rules
 * all agree on what an acceptable task link is.
 *
 * Everything here is pure and free of React and the DOM, so it can be imported
 * from a component, a service or a future server caller unchanged.
 *
 * Security posture: only absolute `http:`/`https:` URLs survive. `javascript:`,
 * `data:`, `file:`, `vbscript:` and every other scheme are rejected before a
 * value is ever persisted, and the same scheme check is repeated in
 * `firestore.rules`. Validation here gives a specific reason to a person; the
 * rules are the boundary a crafted client cannot pass.
 */

/** Longest title Tasky stores. Mirrored by `title.size() <= 200` in the rules. */
export const MAX_LINK_TITLE_LENGTH = 200;

/** Longest URL Tasky stores. Mirrored by `url.size() <= 2048` in the rules. */
export const MAX_LINK_URL_LENGTH = 2048;

/** The only schemes a task link may use. */
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:']);

/** Why a URL was refused. `null` means it is acceptable. */
export type LinkUrlRejectionReason =
  | 'empty'
  | 'malformed'
  | 'unsupported-scheme'
  | 'credentials'
  | 'no-hostname'
  | 'too-long';

/** Why a title was refused. `null` means it is acceptable. */
export type LinkTitleRejectionReason = 'empty' | 'too-long';

export interface LinkUrlValidation {
  valid: boolean;
  reason: LinkUrlRejectionReason | null;
  message: string;
  /** The normalized URL. Present only when `valid`. */
  normalized: string | null;
  /** Hostname derived from the parsed URL. Present only when `valid`. */
  hostname: string | null;
}

export interface LinkTitleValidation {
  valid: boolean;
  reason: LinkTitleRejectionReason | null;
  message: string;
}

function rejectUrl(reason: LinkUrlRejectionReason, message: string): LinkUrlValidation {
  return { valid: false, reason, message, normalized: null, hostname: null };
}

/**
 * Validate and normalize one URL.
 *
 * Normalization is the `URL` constructor's own: it lower-cases the hostname,
 * drops a default port (`:443` on https, `:80` on http), and canonicalizes the
 * path. It deliberately leaves the query string and fragment alone — they are
 * frequently load-bearing on a shared link (`?id=7`, `#section`) — so two links
 * that differ only by a meaningful parameter stay distinct.
 */
export function validateLinkUrl(raw: string): LinkUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) return rejectUrl('empty', 'Enter a URL.');
  if (trimmed.length > MAX_LINK_URL_LENGTH) {
    return rejectUrl('too-long', `A link can be at most ${MAX_LINK_URL_LENGTH} characters.`);
  }

  let parsed: URL;
  try {
    // No base is supplied, so a relative address ("/help", "example.com")
    // throws rather than resolving against the page. Only absolute URLs are
    // acceptable.
    parsed = new URL(trimmed);
  } catch {
    return rejectUrl(
      'malformed',
      'That is not a valid URL. Include the full address, for example https://example.com/page.',
    );
  }

  if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
    return rejectUrl(
      'unsupported-scheme',
      'Only http:// and https:// links can be attached. Other address types are not allowed.',
    );
  }

  // `https://user:secret@example.com` is a phishing shape and an unnecessary
  // way to carry credentials into a shared task, so it is refused outright.
  if (parsed.username || parsed.password) {
    return rejectUrl(
      'credentials',
      'Remove the username and password from the URL. Links cannot carry credentials.',
    );
  }

  if (!parsed.hostname) {
    return rejectUrl('no-hostname', 'That URL has no hostname, so it cannot be opened.');
  }

  return {
    valid: true,
    reason: null,
    message: '',
    normalized: parsed.toString(),
    hostname: parsed.hostname,
  };
}

/** Whether `raw` is an absolute `http(s)` URL Tasky is willing to store. */
export function isAllowedLinkUrl(raw: string): boolean {
  return validateLinkUrl(raw).valid;
}

/**
 * The canonical URL to store and to compare duplicates against.
 *
 * Returns `null` for anything the validator refuses, so a caller that has
 * already surfaced the reason can simply skip the write.
 */
export function normalizeLinkUrl(raw: string): string | null {
  return validateLinkUrl(raw).normalized;
}

/** Hostname of a valid URL, or `null`. Derived from the parsed URL, not splitting. */
export function linkHostname(raw: string): string | null {
  return validateLinkUrl(raw).hostname;
}

/**
 * The key two links are considered duplicates by.
 *
 * It is the normalized URL, so `HTTPS://Example.com:443/x` and
 * `https://example.com/x` collapse together while `?a=1` and `?a=2` do not.
 * Returns `null` for an invalid URL; a caller must not compare `null` keys.
 */
export function linkDuplicateKey(raw: string): string | null {
  return normalizeLinkUrl(raw);
}

/** Validate a link title. The value is trimmed by the caller before storing. */
export function validateLinkTitle(raw: string): LinkTitleValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: 'empty', message: 'Enter a title for this link.' };
  }
  if (trimmed.length > MAX_LINK_TITLE_LENGTH) {
    return {
      valid: false,
      reason: 'too-long',
      message: `A link title can be at most ${MAX_LINK_TITLE_LENGTH} characters.`,
    };
  }
  return { valid: true, reason: null, message: '' };
}

/**
 * A display-friendly shortening of a URL: the hostname, then a trimmed path.
 *
 * Purely cosmetic, and never used as the stored value or the duplicate key. A
 * long path is clipped with an ellipsis so a row stays one line; the full URL
 * is always available through the open and copy actions.
 */
export function shortenLinkUrl(raw: string, maxLength = 48): string {
  const validated = validateLinkUrl(raw);
  if (!validated.valid || !validated.normalized || !validated.hostname) return raw.trim();

  const { hostname, pathname, search, hash } = new URL(validated.normalized);
  const suffix = `${pathname === '/' ? '' : pathname}${search}${hash}`;
  const display = `${hostname}${suffix}`;

  if (display.length <= maxLength) return display;
  return `${display.slice(0, maxLength - 1)}…`;
}
