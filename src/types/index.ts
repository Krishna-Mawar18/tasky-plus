export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

/**
 * Role of a user inside a single workspace.
 *
 * `owner` is unique per workspace and cannot be transferred or downgraded.
 */
export type WorkspaceRole = 'owner' | 'manager' | 'viewer';

/**
 * A membership document at
 * `workspaces/{workspaceId}/members/{uid}`.
 *
 * This subcollection is the authoritative source of truth for who belongs to a
 * workspace and what they may do. `Workspace.members` is a derived UID list kept
 * only so workspace discovery can still use an `array-contains` query.
 */
export interface WorkspaceMember {
  uid: string;
  role: WorkspaceRole;
  /** Denormalised at add time so the members list needs no cross-user read. */
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  /** Email that was used to add this member, normalised. */
  addedBy?: string;
  addedByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal profile stored in `userEmailIndex` so an email can be resolved. */
export interface UserEmailIndexEntry {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  updatedAt?: Date;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;
  ownerId: string;
  /**
   * Derived UID index, maintained alongside the `members` subcollection. Kept
   * because `workspaceService.getWorkspaces` and `subscribeToWorkspaces` query
   * `where('members', 'array-contains', userId)`.
   */
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  columns: BoardColumn[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shape of a column as persisted on the board document.
 * Columns live inside the board doc; tasks live in the top-level `tasks`
 * collection and reference their column through `Task.columnId`.
 */
export interface BoardColumn {
  id: string;
  name: string;
  order: number;
}

/** A column together with the tasks it contains (UI-facing shape). */
export interface Column extends BoardColumn {
  tasks: Task[];
}

export type TaskStatus = 'todo' | 'in-progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /**
   * Primary assignee, kept in step with `assigneeIds[0]`.
   *
   * This field predates multi-assignee support and is still what
   * `statsService.getQuickStats` filters on and what the assignment
   * notification is addressed to, so it is written as the first entry of
   * `assigneeIds` rather than being retired.
   */
  assigneeId?: string;
  assigneeName?: string;
  /**
   * Every assignee, in the order they were picked. Empty means unassigned.
   *
   * Only workspace members may appear here; the Firestore rules reject an id
   * that is not in the workspace's `members` list.
   */
  assigneeIds?: string[];
  /** Parallel to `assigneeIds`, so a card renders without a second read. */
  assigneeNames?: string[];
  dueDate?: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  columnId: string;
  boardId: string;
  workspaceId: string;
  /**
   * Persistent position of the task inside its column, ascending.
   * Uses a sparse numeric scale (1000, 2000, 3000, ...) so a task can be
   * dropped between two others by writing a single document.
   */
  order: number;
  /**
   * `true` once the task has been archived. The document stays in the `tasks`
   * collection — archiving never moves a task anywhere.
   *
   * Absent on documents written before archiving existed, which is why
   * consumers must treat a missing value as "not archived" rather than reading
   * it directly.
   */
  archived?: boolean;
  /** When the task was archived. Drives the 90-day retention sweep. */
  archivedAt?: Date | null;
  /** Who archived it. */
  archivedBy?: string | null;
  // Optional properties added during data loading for UI purposes
  boardName?: string;
}

/**
 * A comment on a task, at `tasks/{taskId}/comments/{commentId}`.
 *
 * A subcollection rather than an array on the task document, so a busy task
 * cannot push the task itself past Firestore's document size limit and so a
 * page of comments can be read on its own.
 *
 * `content` is Markdown. It is rendered through the sanitising renderer in
 * `src/components/task/Markdown.tsx`.
 */
export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  createdAt: Date | null;
  /** `null` until the comment has been edited. */
  updatedAt: Date | null;
}

/** Formats Tasky accepts as attachments. */
export type AttachmentExtension = '.jpg' | '.jpeg' | '.png' | '.pdf' | '.xls' | '.xlsx' | '.md';

/**
 * Attachment metadata only, at `tasks/{taskId}/attachments/{attachmentId}`.
 *
 * There is no URL field on purpose: a signed URL is short-lived and is minted
 * on demand by the storage service. Storing one would leave a stale, possibly
 * public, link behind.
 */
export interface TaskAttachment {
  id: string;
  workspaceId: string;
  boardId: string;
  /** Original filename as uploaded. */
  name: string;
  size: number;
  contentType: string;
  /** Object key in the future S3 bucket. Not a URL. */
  s3Key: string;
  uploadedBy: string;
  createdAt: Date | null;
}

/**
 * An external link attached to a task, at `tasks/{taskId}/links/{linkId}`.
 *
 * A subcollection rather than an array on the task document, for the same
 * reason comments and attachments are: a task with many references would
 * otherwise grow past Firestore's document size limit, and the list is read on
 * its own.
 *
 * Unlike a file attachment, a link is editable. The URL points at something
 * Tasky does not own, so the creator may correct a title or an address without
 * deleting and re-adding the row. `createdBy` and `createdAt` stay pinned.
 */
export interface TaskLink {
  id: string;
  /** Creator's uid. Immutable; the rules bind it to `request.auth.uid`. */
  createdBy: string;
  /** Denormalized at creation so a row renders without a cross-user read. */
  createdByName: string;
  title: string;
  /** Normalized absolute `http(s)` URL. */
  url: string;
  /** Hostname derived from `url`, stored for the shortened display. */
  hostname: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Outcome of one object-store deletion attempt.
 *
 * Split into `deleted` and `pending` on purpose. A report that only had a
 * boolean would let an unreachable bucket look identical to a successful
 * deletion, which is exactly the failure mode this phase must not have.
 */
export interface StorageDeletionReport {
  /** Keys the object store confirmed removal of. */
  deleted: string[];
  /**
   * Keys that still exist because no storage provider could reach them. The
   * caller must surface this rather than discard it.
   */
  pending: string[];
  /** Human-readable reason for every key in `pending`. */
  reason?: string;
}

/** Ids that identify where an object belongs. Never trusted from the client. */
export interface AttachmentObjectLocation {
  workspaceId: string;
  boardId: string;
  taskId: string;
  attachmentId: string;
}

/** Result of a successful object upload. Carries the key, never a URL. */
export interface AttachmentUploadResult {
  s3Key: string;
  /** Bytes actually written. Lets a caller detect a truncated upload. */
  size: number;
}

/** What the cascade and the retention sweep actually removed. */
export interface TaskDeletionReport {
  taskId: string;
  commentsDeleted: number;
  attachmentMetadataDeleted: number;
  linksDeleted: number;
  storage: StorageDeletionReport;
  /** True only when nothing is left behind, including objects. */
  fullyDeleted: boolean;
}

/**
 * A single task write produced by a drag-and-drop operation.
 * `status` is only included when the move actually changes it.
 */
export interface TaskOrderUpdate {
  taskId: string;
  columnId: string;
  order: number;
  status?: TaskStatus;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

export interface QuickStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  productivityScore: number;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  color: string;
}

export interface CreateBoardData {
  name: string;
  description?: string;
} 