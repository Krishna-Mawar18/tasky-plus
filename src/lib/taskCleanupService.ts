import { db } from './firebase';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import type { Task, TaskAttachment, TaskDeletionReport } from '@/types';
import { taskService } from './services';
import { archiveExpiryDate, ARCHIVE_RETENTION_DAYS } from './taskArchive';

/**
 * Permanent removal of archived tasks once they outlive the retention window.
 *
 * ## This runs on demand only
 *
 * There is no scheduler, no timer, no frontend polling and no new cloud
 * scheduler. `purgeExpiredArchivedTasks()` is a plain function that a later
 * phase calls from Cloud Scheduler → Cloud Function, which is where it belongs:
 * the sweep has to delete across every workspace, and only the Admin SDK can do
 * that, since the rules deliberately stop one member reaching another's tasks.
 *
 * The data model already holds everything the sweep needs — `archived` and
 * `archivedAt` are written on the task document — so nothing here has to guess.
 */

/** Upper bound on one sweep, to keep a single run bounded and observable. */
export const DEFAULT_PURGE_LIMIT = 100;

export interface ExpiredTaskSummary {
  taskId: string;
  title: string;
  workspaceId: string;
  boardId: string;
  archivedAt: Date | null;
  /** When the task became eligible for removal. */
  expiresAt: Date | null;
}

export interface PurgeSummary {
  /** How many tasks the query returned. */
  found: number;
  /** Tasks actually deleted, in full. */
  deleted: TaskDeletionReport[];
  /** Tasks whose object files could not be removed. Not retried automatically. */
  incomplete: TaskDeletionReport[];
}

/**
 * The cutoff for "archived longer ago than the retention window".
 *
 * Exported so an operator can see exactly which boundary a sweep would use, and
 * so a dry run and a real run cannot drift apart.
 */
export function archiveExpiryCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 24 * 1000);
}

function toExpiredSummary(snapshot: {
  id: string;
  data: () => Record<string, unknown>;
}): ExpiredTaskSummary {
  const data = snapshot.data();
  const archivedAt =
    typeof (data.archivedAt as { toDate?: () => Date })?.toDate === 'function'
      ? (data.archivedAt as { toDate: () => Date }).toDate()
      : null;

  return {
    taskId: snapshot.id,
    title: String(data.title ?? 'Untitled task'),
    workspaceId: String(data.workspaceId ?? ''),
    boardId: String(data.boardId ?? ''),
    archivedAt,
    expiresAt: archiveExpiryDate(archivedAt),
  };
}

export const taskCleanupService = {
  /**
   * Tasks whose retention window has closed.
   *
   * `where('archived', '==', true)` plus `where('archivedAt', '<=', cutoff)` is
   * the only new query this phase introduces, and it is the reason
   * `firestore.indexes.json` gains a composite index on
   * (`archived`, `archivedAt`).
   *
   * Read-only and safe to call from anywhere. It changes nothing, so it doubles
   * as the dry run for the eventual scheduled job.
   */
  async findExpiredArchivedTasks(
    options: { now?: Date; limit?: number } = {},
  ): Promise<ExpiredTaskSummary[]> {
    if (!db) return [];

    const q = query(
      collection(db, 'tasks'),
      where('archived', '==', true),
      where('archivedAt', '<=', archiveExpiryCutoff(options.now)),
      orderBy('archivedAt'),
      limit(Math.max(1, options.limit ?? DEFAULT_PURGE_LIMIT)),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(toExpiredSummary);
  },

  /**
   * Delete every expired task, with the same cascade a person would trigger.
   *
   * Comments, attachment metadata, object files and the task document go
   * together, through `taskService.deleteTaskCascade`, so there is exactly one
   * deletion implementation to keep correct.
   */
  async purgeExpiredArchivedTasks(
    options: { now?: Date; limit?: number } = {},
  ): Promise<PurgeSummary> {
    const expired = await this.findExpiredArchivedTasks(options);

    const deleted: TaskDeletionReport[] = [];
    const incomplete: TaskDeletionReport[] = [];

    for (const task of expired) {
      try {
        const report = await taskService.deleteTaskCascade(task.taskId);
        if (report.fullyDeleted) {
          deleted.push(report);
        } else {
          incomplete.push(report);
          console.warn(
            `Task ${task.taskId} was removed but ${report.storage.pending.length} object(s) are still present: ${report.storage.reason ?? 'no reason given'}`,
          );
        }
      } catch (error) {
        // One bad task must not abandon the rest of the sweep.
        console.error(`Could not purge expired task ${task.taskId}:`, error);
      }
    }

    return { found: expired.length, deleted, incomplete };
  },
};

/**
 * Attachment keys still awaiting deletion, grouped by task.
 *
 * Not used by the sweep itself — `deleteTaskCascade` collects the keys as it
 * goes — but exported so an operator can list what a previous run left behind
 * once S3 is connected and needs recovering.
 */
export async function findOrphanedAttachmentKeys(taskId: string): Promise<string[]> {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, 'tasks', taskId, 'attachments'));
  return snapshot.docs.map(
    (attachment) => String((attachment.data() as Partial<TaskAttachment>).s3Key ?? ''),
  );
}

/**
 * Re-exported so a caller planning the scheduled job has one import for the
 * whole contract, rather than reaching into `taskArchive` for the number.
 */
export { ARCHIVE_RETENTION_DAYS };

export type { Task };