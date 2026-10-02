'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { BoardColumn, Task, TaskOrderUpdate } from '@/types';
import { COLUMN_PREFIX, KanbanColumn } from './KanbanColumn';
import { TaskCardBody } from './TaskCard';
import { resolveTaskPlacement, tasksInColumn } from '@/lib/taskOrder';

export interface KanbanBoardProps {
  columns: BoardColumn[];
  /**
   * Active tasks only. The page filters archived tasks out before they reach the
   * board, so drag-and-drop and the column counts never see a task that belongs
   * under Archived.
   */
  tasks: Task[];
  /**
   * Apply a completed drag. The board stays stateless: the owner applies the
   * updates optimistically, persists them, and rolls back if the write fails.
   */
  onTasksMove: (updates: TaskOrderUpdate[]) => Promise<void>;
  avatar: React.ReactNode;
  createTaskColumnId: string | null;
  onToggleCreate: (columnId: string) => void;
  onTaskStep: (taskId: string, direction: -1 | 1) => void;
  /**
   * Opens the task detail modal. Passed through to every card, including in
   * read-only mode: reading a task is allowed for viewers. Editing and deleting
   * live inside the modal, so the card carries no edit/delete controls.
   */
  onTaskOpen?: (task: Task) => void;
  renderCreateForm: (columnId: string) => React.ReactNode;
  /**
   * Viewer mode. Disables every sensor and the drop targets, and hides the
   * create, edit, delete and step controls, so the board cannot be mutated.
   */
  readOnly?: boolean;
}

export function KanbanBoard({
  columns,
  tasks,
  onTasksMove,
  avatar,
  createTaskColumnId,
  onToggleCreate,
  onTaskStep,
  onTaskOpen,
  renderCreateForm,
  readOnly = false,
}: KanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const orderedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );

  // Group once per render instead of filtering inside every column.
  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    orderedColumns.forEach((column) => grouped.set(column.id, []));
    tasks.forEach((task) => {
      const bucket = grouped.get(task.columnId);
      if (bucket) bucket.push(task);
    });
    grouped.forEach((bucket, columnId) => grouped.set(columnId, tasksInColumn(bucket, columnId)));
    return grouped;
  }, [tasks, orderedColumns]);

  // `useSensors` is a hook, so the same call shape is kept and only the sensor
  // list is emptied. With no sensors, dnd-kit never starts a drag.
  // A few pixels of travel separate a click from a drag, so the existing
  // edit/delete/step buttons keep working on a plain click. Touch activation is
  // delayed so a touch still scrolls the board and only becomes a drag once the
  // user holds still.
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(
    ...(readOnly ? [] : [pointerSensor, touchSensor, keyboardSensor]),
  );

  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks],
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (readOnly) return;
    setActiveTaskId(String(active.id));
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTaskId(null);
    if (readOnly || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const dragged = tasks.find((task) => task.id === activeId);
    if (!dragged) return;

    // A drop is either on a column container (including an empty one) or on a
    // task, which also tells us the column.
    const droppedOnColumn = overId.startsWith(COLUMN_PREFIX);

    const destinationColumnId = droppedOnColumn
      ? overId.slice(COLUMN_PREFIX.length)
      : tasks.find((task) => task.id === overId)?.columnId;

    if (!destinationColumnId) return;

    const destinationTasks = tasksByColumn.get(destinationColumnId) ?? [];
    const isSameColumn = destinationColumnId === dragged.columnId;

    let targetIndex: number;
    if (droppedOnColumn) {
      // Dropping on the column body sends the task to the bottom; for an empty
      // column this is the only sensible target and lands at index 0.
      targetIndex = isSameColumn ? destinationTasks.length - 1 : destinationTasks.length;
    } else {
      const overIndex = destinationTasks.findIndex((task) => task.id === overId);
      if (overIndex === -1) return;
      targetIndex = overIndex;
    }

    if (isSameColumn) {
      const currentIndex = destinationTasks.findIndex((task) => task.id === activeId);
      // Dropped back where it started — nothing to persist.
      if (currentIndex === targetIndex) return;
    }

    const { updates } = resolveTaskPlacement(dragged, destinationColumnId, targetIndex, tasks, columns);
    if (updates.length === 0) return;

    // `onTasksMove` owns the optimistic update, the rollback and the error
    // notification, so a failure is already reported by the time it resolves.
    await onTasksMove(updates);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveTaskId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px]">
        {orderedColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) ?? []}
            avatar={avatar}
            readOnly={readOnly}
            isCreateOpen={!readOnly && createTaskColumnId === column.id}
            onToggleCreate={readOnly ? undefined : onToggleCreate}
            onStep={readOnly ? undefined : onTaskStep}
            // Not gated on `readOnly`: opening the task is a read.
            onOpen={onTaskOpen}
            canStepBack={
              !readOnly &&
              orderedColumns.findIndex((candidate) => candidate.id === column.id) > 0
            }
            canStepForward={
              !readOnly &&
              orderedColumns.findIndex((candidate) => candidate.id === column.id) <
              orderedColumns.length - 1
            }
          >
            {createTaskColumnId === column.id && !readOnly ? renderCreateForm(column.id) : null}
          </KanbanColumn>
        ))}
      </div>

      {readOnly ? null : (
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeTask ? (
            <div className="pointer-events-none cursor-grabbing rotate-2 scale-[1.02] shadow-2xl rounded-xl">
              <TaskCardBody task={activeTask} avatar={avatar} />
            </div>
          ) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}
