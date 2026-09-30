'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BoardColumn, Task } from '@/types';
import { TaskCard, TaskCardActions } from './TaskCard';
import { Plus, Inbox } from 'lucide-react';

export const COLUMN_PREFIX = 'column:';

export function columnDroppableId(columnId: string): string {
  return `${COLUMN_PREFIX}${columnId}`;
}

interface KanbanColumnProps extends TaskCardActions {
  column: BoardColumn;
  tasks: Task[];
  avatar: React.ReactNode;
  isCreateOpen?: boolean;
  onToggleCreate?: (columnId: string) => void;
  children?: React.ReactNode;
}

/** Per-column accents, matching the colours already used on the board. */
const columnAccents: Record<
  string,
  { dot: string; text: string; badge: string; button: string; highlight: string; ring: string }
> = {
  todo: {
    dot: 'bg-orange-500',
    text: 'text-orange-700 font-bold',
    badge: 'bg-orange-100 text-orange-700',
    button:
      'bg-orange-100 text-orange-600 hover:bg-orange-200 border-2 border-orange-300 hover:border-orange-400',
    highlight: 'bg-orange-50/80',
    ring: 'ring-orange-300',
  },
  inprogress: {
    dot: 'bg-blue-500',
    text: 'text-blue-700 font-bold',
    badge: 'bg-blue-100 text-blue-700',
    button: 'bg-blue-100 text-blue-600 hover:bg-blue-200 border-2 border-blue-300 hover:border-blue-400',
    highlight: 'bg-blue-50/80',
    ring: 'ring-blue-300',
  },
  done: {
    dot: 'bg-green-500',
    text: 'text-green-700 font-bold',
    badge: 'bg-green-100 text-green-700',
    button: 'bg-green-100 text-green-600 hover:bg-green-200 border-2 border-green-300 hover:border-green-400',
    highlight: 'bg-green-50/80',
    ring: 'ring-green-300',
  },
};

const fallbackAccent = {
  dot: 'bg-gray-400',
  text: 'text-gray-700 font-bold',
  badge: 'bg-gray-100 text-gray-600',
  button: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-gray-300 hover:border-gray-400',
  highlight: 'bg-gray-50/80',
  ring: 'ring-gray-300',
};

export function KanbanColumn({
  column,
  tasks,
  avatar,
  isCreateOpen = false,
  onToggleCreate,
  children,
  ...actions
}: KanbanColumnProps) {
  const accents = columnAccents[column.id] ?? fallbackAccent;

  // The whole task-list area is the drop target, so a column with zero tasks
  // is still a valid destination.
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(column.id),
    data: { type: 'column', columnId: column.id },
  });

  const isEmpty = tasks.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-t-xl border border-gray-200 border-b-0 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full shadow-md ${accents.dot}`} />
            <h3 className={`font-mono font-semibold ${accents.text}`}>{column.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-mono font-bold ${accents.badge}`}>
              {tasks.length}
            </span>
          </div>
          {onToggleCreate && (
            <button
              onClick={() => onToggleCreate(column.id)}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md ${accents.button}`}
              title={`Add task to ${column.name}`}
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>
          )}
        </div>

        {/* Inline "new task" form */}
        {isCreateOpen && children}
      </div>

      {/* Task List — drop target */}
      <div
        ref={setNodeRef}
        className={`bg-white/90 backdrop-blur-sm border border-gray-200 rounded-b-xl border-t-0 flex-1 p-4 space-y-3 shadow-lg min-h-[400px] transition-colors duration-200 ${
          isOver ? `${accents.highlight} ring-2 ${accents.ring} border-transparent` : ''
        }`}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} avatar={avatar} {...actions} />
          ))}
        </SortableContext>

        {isEmpty && (
          <div
            className={`text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl transition-colors duration-200 ${
              isOver ? `${accents.highlight} ${accents.ring} text-gray-600` : ''
            }`}
          >
            <Inbox className="mx-auto mb-2 w-8 h-8 opacity-40" />
            <p className="text-sm font-mono">{isOver ? 'Drop task here' : 'No tasks yet'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
