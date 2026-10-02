import type {
  AttachmentObjectLocation,
  AttachmentUploadResult,
  StorageDeletionReport,
} from '@/types';

/**
 * The object-store boundary.
 *
 * Everything above this interface — the attachment UI, the metadata service,
 * the cascade delete and the retention sweep — is written against these three
 * operations only. Adding S3 in a later phase means writing one implementation
 * and registering it in `resolveAttachmentStorage`; no caller changes.
 *
 * There is deliberately no `url()` on any metadata type. A signed URL expires,
 * so minting it per request keeps a stale public link out of Firestore.
 */
export interface AttachmentStorageProvider {
  /** Stable identifier, recorded in logs and error messages. */
  readonly id: string;

  /**
   * Whether this provider can actually reach an object store right now.
   *
   * The attachment UI reads this to decide whether to offer an upload control
   * at all, rather than letting a person pick a file only to be refused.
   */
  isAvailable(): boolean;

  /**
   * Store `file` under the key derived from `location`.
   *
   * Must reject rather than silently succeed: a caller that is told an upload
   * worked will write metadata for a file that does not exist.
   */
  uploadAttachment(
    location: AttachmentObjectLocation,
    file: File,
  ): Promise<AttachmentUploadResult>;

  /**
   * Mint a short-lived read URL for one object.
   *
   * PDF, spreadsheet and Markdown attachments are download-only, so callers
   * only ask for a URL when the user actually downloads.
   */
  getDownloadUrl(s3Key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Remove objects by key.
   *
   * Must report what it could not remove rather than claiming success, so the
   * caller can tell the difference between "deleted" and "not reachable".
   */
  deleteAttachments(s3Keys: string[]): Promise<StorageDeletionReport>;
}

/** Raised whenever an operation needs a configured object store and finds none. */
export class StorageNotConfiguredError extends Error {
  readonly code = 'storage-not-configured';

  constructor(operation: string) {
    super(
      `File storage is not configured, so "${operation}" cannot run. ` +
        'Object storage (S3) is scheduled for a later phase; nothing was uploaded or removed.',
    );
    this.name = 'StorageNotConfiguredError';
  }
}

/** True for the error thrown by the placeholder provider. */
export function isStorageNotConfigured(error: unknown): error is StorageNotConfiguredError {
  return (
    error instanceof StorageNotConfiguredError ||
    (error as { code?: string } | null)?.code === 'storage-not-configured'
  );
}

/**
 * The provider registered in this phase.
 *
 * Every method refuses. It does not accept a file and forget about it, and it
 * does not hand back a placeholder URL — both would leave the UI claiming a
 * file exists when nothing was stored.
 */
export const unconfiguredAttachmentStorageProvider: AttachmentStorageProvider = {
  id: 'unconfigured',

  isAvailable() {
    return false;
  },

  async uploadAttachment() {
    throw new StorageNotConfiguredError('upload');
  },

  async getDownloadUrl() {
    throw new StorageNotConfiguredError('download');
  },

  async deleteAttachments(s3Keys: string[]): Promise<StorageDeletionReport> {
    // Not an error: deletion runs as part of a cascade that has already removed
    // the metadata, and throwing here would strand the task document. The keys
    // are reported as still present so nothing is silently dropped.
    return {
      deleted: [],
      pending: [...s3Keys],
      reason: 'No object storage is configured, so no files were removed.',
    };
  },
};

/**
 * The single place a concrete provider is chosen.
 *
 * Phase 2 registers an `S3AttachmentStorageProvider` here. Until then this
 * resolves to the refusing implementation, which is why the attachment UI shows
 * "not configured" rather than a failed upload.
 */
export function resolveAttachmentStorage(): AttachmentStorageProvider {
  return unconfiguredAttachmentStorageProvider;
}

/**
 * The one and only place an object key is built.
 *
 * Key
 * `workspaces/{workspaceId}/boards/{boardId}/tasks/{taskId}/attachments/{attachmentId}`
 *
 * Every segment is an id the caller already read from Firestore — none of them
 * come from a filename, a user input field or a URL — so a key can never be
 * steered at another workspace or another tenant's task.
 *
 * The identical string is reconstructed inside `firestore.rules` when an
 * attachment document is created, so a client that writes a different key is
 * rejected by the rules and not merely ignored.
 *
 * The original filename is deliberately absent: it lives in the attachment
 * metadata, and putting user text into an object key invites traversal and
 * encoding trouble for no benefit.
 */
export function buildAttachmentObjectKey(location: AttachmentObjectLocation): string {
  const segments = [
    'workspaces',
    location.workspaceId,
    'boards',
    location.boardId,
    'tasks',
    location.taskId,
    'attachments',
    location.attachmentId,
  ];

  if (segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    throw new Error('Attachment object key segments must be alphanumeric, dash or underscore.');
  }

  return segments.join('/');
}