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
  assigneeId?: string;
  assigneeName?: string;
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
  // Optional properties added during data loading for UI purposes
  boardName?: string;
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