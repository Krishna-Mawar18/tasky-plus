import type { AttachmentExtension } from '@/types';

/**
 * Attachment rules, in one place so the browser, the (future) API route and the
 * (future) S3 worker all enforce the same thing.
 *
 * Front-end validation is a convenience. It exists to give an immediate,
 * specific reason on the file the person just picked — it is never the control.
 * The object-store step re-runs `validateAttachmentFile` server-side before it
 * trusts a byte.
 */

/** Hard ceiling, 10 MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Accepted extensions, each mapped to the MIME types a browser may legitimately
 * report for it.
 *
 * `xls` is listed because Tasky accepts it, though browsers usually report the
 * legacy `application/vnd.ms-excel` or a generic blob type; the blank string
 * below means "this browser tells us nothing useful, so accept whatever it
 * claims and let the extension carry the decision".
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS: readonly AttachmentExtension[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.xls',
  '.xlsx',
  '.md',
];

const MIME_TYPES_BY_EXTENSION: Record<AttachmentExtension, readonly string[]> = {
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
  '.png': ['image/png'],
  '.pdf': ['application/pdf'],
  '.xls': ['application/vnd.ms-excel', 'application/x-ms-excel', 'application/octet-stream', ''],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/zip',
    'application/octet-stream',
    '',
  ],
  '.md': ['text/markdown', 'text/plain', 'text/x-markdown', ''],
};

/** Only these render inline. Everything else is download-only, by design. */
export const PREVIEWABLE_IMAGE_EXTENSIONS: readonly AttachmentExtension[] = ['.jpg', '.jpeg', '.png'];

/** MIME types accepted for an inline image preview. */
export const PREVIEWABLE_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png'];

/** Why a file was refused. `null` means it is acceptable. */
export type AttachmentRejectionReason =
  | 'empty-file'
  | 'no-filename'
  | 'unsupported-extension'
  | 'unsupported-type'
  | 'too-large';

export interface FileValidationResult {
  valid: boolean;
  reason: AttachmentRejectionReason | null;
  message: string;
}

/**
 * Lower-cased extension including the dot, or `null` when the name has none.
 *
 * A leading dot alone (`.gitignore`) is not an extension, so it is rejected
 * rather than being read as an empty suffix.
 */
export function attachmentExtension(filename: string): AttachmentExtension | null {
  const trimmed = filename.trim();
  if (!trimmed) return null;

  // The extension is the suffix after the *last* dot, so the dot sits somewhere in
  // the middle of a normal name ("report.pdf"), not at the start.
  const index = trimmed.lastIndexOf('.');
  if (index <= 0 || index === trimmed.length - 1) return null;

  const extension = trimmed.slice(index).toLowerCase() as AttachmentExtension;
  return ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension) ? extension : null;
}

/**
 * Whether Tasky renders this attachment inline.
 *
 * JPG/JPEG/PNG only. PDF, spreadsheets and Markdown are deliberately
 * download-only: no viewer, no parser, no extraction.
 */
export function isPreviewableImage(extension: AttachmentExtension, contentType: string): boolean {
  if (!PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension)) return false;
  return PREVIEWABLE_IMAGE_MIME_TYPES.includes(contentType.toLowerCase());
}

/**
 * Full validation of one candidate file: name, extension, reported type and
 * size.
 *
 * Kept free of React and of the DOM so the future server-side caller can
 * import it unchanged.
 */
export function validateAttachmentFile(file: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  const name = file.name?.trim() ?? '';

  if (!name) {
    return reject('no-filename', 'That file has no name, so its type cannot be checked.');
  }
  if (file.size <= 0) {
    return reject('empty-file', `"${name}" is empty. Attach a file that has content.`);
  }

  const extension = attachmentExtension(name);
  if (!extension) {
    return reject(
      'unsupported-extension',
      `"${name}" is not a supported file type. Allowed: ${formatAllowedExtensions()}.`,
    );
  }

  const declaredType = (file.type ?? '').toLowerCase();
  const allowedTypes = MIME_TYPES_BY_EXTENSION[extension];
  if (!allowedTypes.includes(declaredType)) {
    return reject(
      'unsupported-type',
      declaredType
        ? `${name} reports the type "${declaredType}", which does not match a .${extension.slice(1)} file.`
        : `${name} does not report a file type, so it cannot be verified as a .${extension.slice(1)} file.`,
    );
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return reject(
      'too-large',
      `${name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    );
  }

  return { valid: true, reason: null, message: '' };
}

/**
 * Normalise a filename for duplicate comparison only.
 *
 * Case-folded and whitespace-trimmed, so `Design.PDF` and `design.pdf ` are
 * recognised as the same attachment. The stored name keeps its original casing:
 * this value is never written anywhere.
 */
export function attachmentDuplicateKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether `incoming` would collide with one of `existing`.
 *
 * Scoped to a single task by the caller — Tasky deliberately does no
 * cross-task duplicate detection, so the same filename on two different tasks
 * is fine.
 */
export function isDuplicateFilename(
  existingNames: readonly string[],
  incoming: string,
): { duplicate: boolean; conflictingName: string | null } {
  const key = attachmentDuplicateKey(incoming);
  const conflict = existingNames.find((name) => attachmentDuplicateKey(name) === key);
  return { duplicate: conflict !== undefined, conflictingName: conflict ?? null };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAllowedExtensions(): string {
  return ALLOWED_ATTACHMENT_EXTENSIONS.join(', ');
}

function reject(reason: AttachmentRejectionReason, message: string): FileValidationResult {
  return { valid: false, reason, message };
}