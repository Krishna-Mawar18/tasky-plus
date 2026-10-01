'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskPriority } from '@/types';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  Edit,
  Trash2,
} from 'lucide-react';

export interface TaskCardActions {
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  /** Directional "move back" / "move forward" buttons, as on the existing board. */
  onStep?: (taskId: string, direction: -1 | 1) => void;
  canStepBack?: boolean;
  canStepForward?: boolean;
  /** Viewer mode: the card can be read but not dragged or edited. */
  readOnly?: boolean;
}

interface TaskCardProps extends TaskCardActions {
  task: Task;
  avatar: React.ReactNode;
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const priorityIcons: Record<TaskPriority, React.ReactNode> = {
  low: <Circle className="w-3 h-3" />,
  medium: <Clock className="w-3 h-3" />,
  high: <AlertCircle className="w-3 h-3" />,
};

export function formatDueDate(date: Date): string {
  const now = new Date();
  const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) return 'Overdue';
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Tomorrow';
  return `${diffInDays} days`;
}

/**
 * The task card, wired up as a draggable sortable item.
 *
 * The dnd-kit transform is applied to this outer wrapper while the existing
 * hover lift lives on the inner card, so the two never fight over `transform`.
 *
 * With `readOnly` the sortable is disabled and the drag listeners are never
 * attached, so a viewer's pointer falls through to text selection and the
 * browser handles scrolling normally.
 */
export function TaskCard({ task, avatar, readOnly = false, ...actions }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task }, disabled: readOnly });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
      // `touch-manipulation` (not `touch-none`) keeps touch scrolling and pinch
      // zoom working on the board; TouchSensor's delay is what separates a drag
      // from a scroll or a tap.
      className={`group relative touch-manipulation select-none rounded-xl ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <TaskCardBody task={task} avatar={avatar} {...actions} />
    </div>
  );
}

/**
 * Presentational task card. Rendered both in the board and inside the
 * `DragOverlay`, so it must not register any drag behaviour of its own.
 */
export function TaskCardBody({ task, avatar, ...actions }: TaskCardProps) {
  const {
    onEdit,
    onDelete,
    onStep,
    canStepBack = false,
    canStepForward = false,
  } = actions;

  // Keep drag gestures from starting on the nested buttons, and keep their
  // clicks/keys from being read as a drag on the card.
  const stopPointer = (event: React.PointerEvent) => event.stopPropagation();
  const stopClick = (event: React.MouseEvent) => event.stopPropagation();
  const stopKey = (event: React.KeyboardEvent) => event.stopPropagation();

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm p-5 rounded-xl border border-gray-200/60 hover:border-gray-300 hover:shadow-2xl transition-all duration-300 cursor-grab active:cursor-grabbing hover:scale-[1.03] hover:-translate-y-1 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

      {/* Task Header */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <h4 className="font-mono font-bold text-base text-gray-900 flex-1 pr-2 group-hover:text-blue-700 transition-colors leading-tight">
          {task.title}
        </h4>
        <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
          {onEdit && (
            <button
              onPointerDown={stopPointer}
              onKeyDown={stopKey}
              onClick={(event) => {
                stopClick(event);
                onEdit(task);
              }}
              className="relative w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:shadow-lg sm:hover:scale-110 transition-all duration-300 group/btn overflow-hidden"
              title="Edit task"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 opacity-0 sm:group-hover/btn:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 sm:group-hover/btn:text-blue-600 transition-colors duration-300" />
              </div>
            </button>
          )}
          {onDelete && (
            <button
              onPointerDown={stopPointer}
              onKeyDown={stopKey}
              onClick={(event) => {
                stopClick(event);
                onDelete(task.id);
              }}
              className="relative w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl hover:bg-red-50 hover:border-red-200 hover:shadow-lg sm:hover:scale-110 transition-all duration-300 group/btn overflow-hidden"
              title="Delete task"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 opacity-0 sm:group-hover/btn:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 sm:group-hover/btn:text-red-600 transition-colors duration-300" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Task Description */}
      {task.description && (
        <p className="text-sm text-gray-600 font-mono mb-4 line-clamp-2 leading-relaxed relative z-10">
          {task.description}
        </p>
      )}

      {/* Task Meta */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full font-mono text-xs font-semibold shadow-sm ${priorityColors[task.priority]} border`}
          >
            {priorityIcons[task.priority]}
            <span className="ml-1.5 capitalize">{task.priority}</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {task.dueDate && (
            <span
              className={`text-xs font-mono font-semibold px-2 py-1 rounded-md ${
                new Date(task.dueDate) < new Date()
                  ? 'text-red-700 bg-red-50 border border-red-200'
                  : new Date(task.dueDate).toDateString() === new Date().toDateString()
                    ? 'text-orange-700 bg-orange-50 border border-orange-200'
                    : 'text-gray-700 bg-gray-50 border border-gray-200'
              }`}
            >
              {formatDueDate(new Date(task.dueDate))}
            </span>
          )}
        </div>
      </div>

      {/* Task Actions */}
      <div className="pt-3 border-t border-gray-200/60 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {avatar}
          </div>
          <span className="text-xs text-gray-600 font-mono font-medium">
            {task.assigneeName}
          </span>
        </div>
        <div className="flex space-x-1">
          {canStepBack && (
            <button
              onPointerDown={stopPointer}
              onKeyDown={stopKey}
              onClick={(event) => {
                stopClick(event);
                onStep?.(task.id, -1);
              }}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm"
              title="Move back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {canStepForward && (
            <button
              onPointerDown={stopPointer}
              onKeyDown={stopKey}
              onClick={(event) => {
                stopClick(event);
                onStep?.(task.id, 1);
              }}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm"
              title="Move forward"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

