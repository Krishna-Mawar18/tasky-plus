import { db } from './firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { TaskAttachment } from '@/types';
import { resolveAttachmentStorage, buildAttachmentObjectKey } from './storageService';
import {
  attachmentExtension,
  isDuplicateFilename,
  validateAttachmentFile,
  type AttachmentRejectionReason,
} from './fileValidation';

/**
 * Attachment metadata at `tasks/{taskId}/attachments/{attachmentId}`.
 *
 * Metadata only. The file itself belongs to an object store that is reached
 * through `storageService`, never through this module.
 */

export type AttachmentErrorCode =
  | 'not-signed-in'
  | 'firebase-not-configured'
  | 'insufficient-permission'
  | 'invalid-file'
  | 'duplicate-filename'
  | 'storage-not-configured'
  | 'storage-failed'
  | 'not-found'
  | 'unknown';

/**
 * A refusal the UI can explain, carrying the specific reason so it can say which
 * rule was broken rather than "attachment failed".
 */
export class AttachmentOperationError extends Error {
  readonly code: AttachmentErrorCode;
  readonly reason: AttachmentRejectionReason | null;

  constructor(code: AttachmentErrorCode, message?: string, reason: AttachmentRejectionReason | null = null) {
    super(message ?? attachmentErrorMessages[code]);
    this.name = 'AttachmentOperationError';
    this.code = code;
    this.reason = reason;
  }
}

const attachmentErrorMessages: Record<AttachmentErrorCode, string> = {
  'not-signed-in': 'You need to be signed in to manage attachments.',
  'firebase-not-configured': 'Firebase is not configured.',
  'insufficient-permission': 'Your role does not allow this action.',
  'invalid-file': 'That file cannot be attached.',
  'duplicate-filename': 'A file with that name is already attached to this task.',
  'storage-not-configured': 'File storage is not connected yet, so nothing can be uploaded.',
  'storage-failed': 'The file could not be stored.',
  'not-found': 'That attachment no longer exists.',
  unknown: 'Something went wrong. Please try again.',
};

export function describeAttachmentError(error: unknown): string {
  if (error instanceof AttachmentOperationError) return error.message;

  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return attachmentErrorMessages['insufficient-permission'];
  if (code === 'unauthenticated') return attachmentErrorMessages['not-signed-in'];
  if (code === 'storage-not-configured') return attachmentErrorMessages['storage-not-configured'];
  return attachmentErrorMessages.unknown;
}

function attachmentsRef(taskId: string) {
  return collection(db!, 'tasks', taskId, 'attachments');
}

function toAttachment(snapshot: {
  id: string;
  data: () => Record<string, unknown>;
}): TaskAttachment {
  const data = snapshot.data();
  const createdAt = data.createdAt;

  return {
    id: snapshot.id,
    workspaceId: String(data.workspaceId ?? ''),
    boardId: String(data.boardId ?? ''),
    name: String(data.name ?? 'Untitled'),
    size: typeof data.size === 'number' ? data.size : 0,
    contentType: String(data.contentType ?? ''),
    s3Key: String(data.s3Key ?? ''),
    uploadedBy: String(data.uploadedBy ?? ''),
    createdAt:
      typeof (createdAt as { toDate?: () => Date })?.toDate === 'function'
        ? (createdAt as { toDate: () => Date }).toDate()
        : null,
  };
}

export const attachmentService = {
  /**
   * Every attachment on a task, newest first.
   *
   * A task's attachment list is bounded by the 10 MB per-file rule and one file
   * at a time in the UI, so there is no pagination here yet. Should that change,
   * this is the one query to convert.
   */
  async getAttachments(taskId: string): Promise<TaskAttachment[]> {
    if (!db) return [];
    try {
      const snapshot = await getDocs(query(attachmentsRef(taskId), orderBy('createdAt', 'desc')));
      return snapshot.docs.map(toAttachment);
    } catch (error) {
      console.error('Error loading attachments:', error);
      throw error;
    }
  },

  /**
   * Validate, reject duplicates, store the object, then record its metadata.
   *
   * Order matters. Nothing is written to Firestore until the object store has
   * confirmed the upload, so a failure can never leave a metadata row pointing
   * at a file that was never stored.
   *
   * In this phase step three always fails, because no provider is configured.
   * That is the correct outcome: the caller reports "storage is not connected"
   * and the task is left exactly as it was.
   */
  async attachFile(input: {
    taskId: string;
    workspaceId: string;
    boardId: string;
    uploadedBy: string;
    file: File;
  }): Promise<TaskAttachment> {
    if (!db) throw new AttachmentOperationError('firebase-not-configured');

    const validation = validateAttachmentFile(input.file);
    if (!validation.valid) {
      throw new AttachmentOperationError('invalid-file', validation.message, validation.reason);
    }

    await this.assertFilenameAvailable(input.taskId, input.file.name);

    // Minted here so the key is written from ids the caller already read, and so
    // the rules can rebuild the identical string and compare.
    const attachmentId = doc(attachmentsRef(input.taskId)).id;
    const s3Key = buildAttachmentObjectKey({
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      taskId: input.taskId,
      attachmentId,
    });

    const contentType = input.file.type || 'application/octet-stream';
    const extension = attachmentExtension(input.file.name) ?? '.md';
    const storage = resolveAttachmentStorage();

    // Throws `StorageNotConfiguredError` today. Phase 2 replaces the body of
    // this call and nothing above it.
    await storage.uploadAttachment(
      {
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        taskId: input.taskId,
        attachmentId,
      },
      input.file,
    );

    await setDoc(doc(db, 'tasks', input.taskId, 'attachments', attachmentId), {
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      name: input.file.name,
      size: input.file.size,
      contentType,
      s3Key,
      uploadedBy: input.uploadedBy,
      // Kept so a reader can tell a real upload from a metadata row that
      // predates the storage integration.
      extension,
      createdAt: serverTimestamp(),
    });

    return {
      id: attachmentId,
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      name: input.file.name,
      size: input.file.size,
      contentType,
      s3Key,
      uploadedBy: input.uploadedBy,
      createdAt: null,
    };
  },

  /**
   * Reject a filename already used on this task.
   *
   * Scoped to the task on purpose: the same filename on a different task is
   * perfectly normal, and Tasky does no global duplicate detection.
   */
  async assertFilenameAvailable(taskId: string, filename: string): Promise<void> {
    if (!db) throw new AttachmentOperationError('firebase-not-configured');

    const existing = await this.getAttachments(taskId);
    const { duplicate, conflictingName } = isDuplicateFilename(
      existing.map((attachment) => attachment.name),
      filename,
    );

    if (duplicate) {
      throw new AttachmentOperationError(
        'duplicate-filename',
        `"${conflictingName}" is already attached to this task. Rename the file, or remove the existing attachment first.`,
      );
    }
  },

  /**
   * Ask the storage service for a short-lived download URL.
   *
   * Refuses while no provider is configured. The UI turns that into "download
   * is unavailable", never into a fabricated link.
   */
  async getDownloadUrl(attachment: TaskAttachment): Promise<string> {
    return resolveAttachmentStorage().getDownloadUrl(attachment.s3Key);
  },

  /** Mint a temporary URL for an inline image preview, same contract as above. */
  async getPreviewUrl(attachment: TaskAttachment): Promise<string> {
    return resolveAttachmentStorage().getDownloadUrl(attachment.s3Key, 300);
  },

  /**
   * Remove an attachment: metadata first, then the object.
   *
   * The order is a safety property. If the object deletion fails the metadata is
   * already gone, which leaves an orphan object in the bucket — invisible, and
   * reclaimable — rather than a live metadata row whose file has vanished.
   */
  async deleteAttachment(input: {
    taskId: string;
    attachmentId: string;
    s3Key: string;
  }): Promise<{ storagePending: boolean }> {
    if (!db) throw new AttachmentOperationError('firebase-not-configured');

    await deleteDoc(doc(db, 'tasks', input.taskId, 'attachments', input.attachmentId));

    const report = await resolveAttachmentStorage().deleteAttachments([input.s3Key]);
    return { storagePending: report.pending.length > 0 };
  },
};