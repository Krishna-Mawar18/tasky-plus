import { BoardColumn, Task, TaskOrderUpdate, TaskStatus } from '@/types';

/**
 * Gap between two adjacent tasks on a freshly seeded column.
 * Keeping the step large means a single dropped task usually only needs one
 * document write to land between two neighbours.
 */
export const ORDER_STEP = 1000;

/**
 * Upper bound on a column's order magnitude before we consider the values
 * exhausted and renumber the column back onto the clean grid.
 */
const MAX_ORDER_MAGNITUDE = 1_000_000_000;

/** Default columns, matching the columns written by the board creation flow. */
export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'todo', name: 'To Do', order: 0 },
  { id: 'inprogress', name: 'In Progress', order: 1 },
  { id: 'done', name: 'Done', order: 2 },
];

const COMPLETED_COLUMN_IDS = new Set(['done', 'completed', 'resolved']);
const IN_PROGRESS_COLUMN_IDS = new Set(['inprogress', 'in-progress', 'inprogress-column']);

/** Minimal shape the ordering helpers need. */
export interface Orderable {
  id: string;
  order?: number;
  createdAt: Date;
}

/** `order` may be missing on documents written before ordering existed. */
export function effectiveOrder(task: { order?: number }): number {
  return typeof task.order === 'number' && Number.isFinite(task.order) ? task.order : 0;
}

/** True when a task predates the `order` field and needs migrating. */
export function isMissingOrder(task: { order?: number }): boolean {
  return typeof task.order !== 'number' || !Number.isFinite(task.order);
}

/**
 * Deterministic `order ASC` sort. Never relies on Firestore document order:
 * ties and legacy documents fall back to `createdAt`, then to document id so
 * the same board always renders in the same sequence.
 */
export function sortTasksByOrder<T extends Orderable>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const delta = effectiveOrder(a) - effectiveOrder(b);
    if (delta !== 0) return delta;

    const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreatedAt !== 0) return byCreatedAt;

    return a.id.localeCompare(b.id);
  });
}

/** All tasks belonging to a column, in `order ASC`. */
export function tasksInColumn(tasks: Task[], columnId: string): Task[] {
  return sortTasksByOrder(tasks.filter((task) => task.columnId === columnId));
}

/**
 * Pick an integer that sorts strictly between `prev` and `next`.
 *
 * Returns `null` when no such integer exists (neighbours are adjacent or the
 * value range is exhausted), which is the caller's signal to renumber.
 */
export function computeInsertOrder(prev: number | null, next: number | null): number | null {
  if (prev === null && next === null) return ORDER_STEP;
  if (Math.abs(prev ?? 0) > MAX_ORDER_MAGNITUDE || Math.abs(next ?? 0) > MAX_ORDER_MAGNITUDE) {
    return null;
  }

  let candidate: number;
  if (prev === null) {
    // Inserting at the very top: take the midpoint of the ceiling so repeated
    // top insertions halve the gap instead of walking it down by `ORDER_STEP`.
    candidate = Math.floor((next as number) / 2);
  } else if (next === null) {
    candidate = prev + ORDER_STEP;
  } else {
    candidate = Math.floor((prev + next) / 2);
  }

  if (!Number.isSafeInteger(candidate)) return null;
  // 0 is reserved: `effectiveOrder` treats a non-numeric `order` as 0, so a
  // real 0 would be indistinguishable from a legacy document.
  if (candidate <= 0) return null;
  if (prev !== null && candidate <= prev) return null;
  if (next !== null && candidate >= next) return null;
  return candidate;
}

/** Renumber a column onto the clean `1000, 2000, 3000, ...` grid. */
export function gridOrders(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * ORDER_STEP);
}

/**
 * Map a column id onto the legacy `status` field so dashboard stats keep
 * agreeing with a task's position on the board.
 *
 * Known column ids win; anything else is inferred from the column's position.
 */
export function statusForColumn(columnId: string, columns: BoardColumn[]): TaskStatus {
  if (COMPLETED_COLUMN_IDS.has(columnId)) return 'completed';
  if (IN_PROGRESS_COLUMN_IDS.has(columnId)) return 'in-progress';

  const ordered = [...columns].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((column) => column.id === columnId);
  if (index <= 0) return 'todo';
  if (index === ordered.length - 1) return 'completed';
  return 'in-progress';
}

/** Previous / next column in board order, used by the move-forward/back buttons. */
export function neighbourColumnId(columnId: string, columns: BoardColumn[], direction: -1 | 1): string | null {
  const ordered = [...columns].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((column) => column.id === columnId);
  if (index === -1) return null;

  const target = ordered[index + direction];
  return target ? target.id : null;
}

export interface ResolvedPlacement {
  /** Writes to persist, already deduplicated and narrowed to what changed. */
  updates: TaskOrderUpdate[];
  /** The destination column in its final visual order (active task included). */
  orderedTasks: Task[];
}

/**
 * Work out the writes required to place `activeTask` at `targetIndex` of
 * `columnId`.
 *
 * The common path writes exactly one document: a midpoint `order` derived from
 * the two neighbours. Only when no representable midpoint exists is the whole
 * column renumbered, and even then it is a single batch.
 */
export function resolveTaskPlacement(
  activeTask: Task,
  columnId: string,
  targetIndex: number,
  allTasks: Task[],
  columns: BoardColumn[],
): ResolvedPlacement {
  const destination = tasksInColumn(
    allTasks.filter((task) => task.id !== activeTask.id),
    columnId,
  );

  const index = Math.max(0, Math.min(targetIndex, destination.length));
  const orderedTasks = [
    ...destination.slice(0, index),
    { ...activeTask, columnId },
    ...destination.slice(index),
  ];

  const previous = index > 0 ? destination[index - 1] : null;
  const next = index < destination.length ? destination[index] : null;

  const midpoint = computeInsertOrder(
    previous ? effectiveOrder(previous) : null,
    next ? effectiveOrder(next) : null,
  );

  const status = statusForColumn(columnId, columns);
  const activeStatus = activeTask.columnId === columnId && activeTask.status === status ? undefined : status;

  if (midpoint !== null) {
    return {
      updates: [{ taskId: activeTask.id, columnId, order: midpoint, ...(activeStatus ? { status: activeStatus } : {}) }],
      orderedTasks,
    };
  }

  // No room between the neighbours: renumber the column onto the grid and let
  // the moved task take its slot. One batch, rare, and it repairs the values
  // for every future move. Only `order` is touched here — rebalancing must not
  // rewrite fields on tasks that did not move.
  const orders = gridOrders(orderedTasks.length);
  const updates: TaskOrderUpdate[] = orderedTasks.map((task, position) => ({
    taskId: task.id,
    columnId: task.columnId,
    order: orders[position],
    ...(task.id === activeTask.id && activeStatus ? { status: activeStatus } : {}),
  }));

  return { updates, orderedTasks };
}
