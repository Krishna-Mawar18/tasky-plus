import type { BoardColumn, Task } from '@/types';

/**
 * Archiving keeps the task document exactly where it is.
 *
 * Nothing is moved to another collection and no document is deleted: the only
 * change is that `archived` becomes `true` alongside the audit fields. That
 * keeps the board's existing `where('boardId', '==')` query and index intact,
 * and makes a restore a two-field write on the same document.
 */

/**
 * How long an archived task is kept before the retention sweep may remove it.
 *
 * The sweep itself is not scheduled yet — see `taskCleanupService`. This number
 * is the single definition of "expired" shared by the UI copy, the sweep and
 * the tests, so the three can never disagree.
 */
export const ARCHIVE_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A task is archived when `archived === true`.
 *
 * Written as a function rather than `task.archived` because documents created
 * before archiving existed have no such field at all, and `undefined` is falsy
 * in the same way — but the intent is easier to read, and it gives one place to
 * change if a third state is ever added.
 */
export function isArchived(task: Pick<Task, 'archived'>): boolean {
  return task.archived === true;
}

/** The tasks the board should render in its columns. */
export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !isArchived(task));
}

/** The tasks listed under the board's Archived section. */
export function archivedTasks(tasks: Task[]): Task[] {
  return tasks.filter(isArchived);
}

/**
 * The moment an archived task becomes eligible for permanent removal.
 *
 * `null` for a task that is not archived, which is what keeps the sweep from
 * ever selecting an active task.
 */
export function archiveExpiryDate(archivedAt: Date | null | undefined): Date | null {
  if (!archivedAt || Number.isNaN(archivedAt.getTime())) return null;
  return new Date(archivedAt.getTime() + ARCHIVE_RETENTION_DAYS * MS_PER_DAY);
}

/** Whether an archived task has outlived the retention window. */
export function isArchiveExpired(
  task: Pick<Task, 'archived' | 'archivedAt'>,
  now: Date = new Date(),
): boolean {
  const expiry = isArchived(task) ? archiveExpiryDate(task.archivedAt) : null;
  return expiry !== null && expiry.getTime() <= now.getTime();
}

/** Whole days left before a task is due for permanent removal. Never negative. */
export function daysUntilArchiveExpiry(
  task: Pick<Task, 'archived' | 'archivedAt'>,
  now: Date = new Date(),
): number | null {
  const expiry = isArchived(task) ? archiveExpiryDate(task.archivedAt) : null;
  if (!expiry) return null;
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / MS_PER_DAY));
}

/**
 * Where a restored task should land.
 *
 * Normally its original column. If that column has since been deleted, the
 * first column in board order is used — an existing column, never a new one, so
 * a restore can never resurrect a task into a column the board does not have.
 *
 * Returns `null` only when the board has no columns at all, which the caller
 * must treat as "cannot restore right now" rather than inventing a column id.
 */
export function restoreColumnId(task: Pick<Task, 'columnId'>, columns: BoardColumn[]): string | null {
  const ordered = [...columns].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) return null;

  const original = ordered.find((column) => column.id === task.columnId);
  if (original) return original.id;

  return ordered[0].id;
}