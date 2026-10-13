'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Edit3,
  Loader2,
  Tag,
  Trash2,
  X,
  Archive,
  RotateCcw,
} from 'lucide-react';
import type { BoardColumn, Task, WorkspaceMember, WorkspaceRole } from '@/types';
import { canArchiveTasks } from '@/lib/permissions';
import { formatDate } from '@/lib/datetime';
import { daysUntilArchiveExpiry, isArchived } from '@/lib/taskArchive';
import { AssigneePicker } from './AssigneePicker';
import { AttachmentSection } from './AttachmentSection';
import { CommentSection } from './CommentSection';

export interface TaskEditFormValues {
  title: string;
  description: string;
  priority: Task['priority'];
  dueDate: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  columns: BoardColumn[];
  members: WorkspaceMember[];
  role: WorkspaceRole | null;
  currentUserId: string | null;
  currentUserName: string;
  currentUserPhotoURL: string | null;
  /** Whether this user may edit the task. Viewers cannot. */
  canEdit: boolean;
  onCloseAction: () => void;
  /** Persists the task fields. Reuses the board's existing update path. */
  onSaveAction: (taskId: string, values: TaskEditFormValues) => Promise<void>;
  onSaveAssigneesAction: (taskId: string, uids: string[]) => Promise<void>;
  onArchiveAction: (task: Task) => void;
  onRestoreAction: (task: Task) => void;
  /** Opens the board's permanent-delete confirmation. */
  onRequestDeleteAction: (task: Task) => void;
}

const priorityStyles: Record<Task['priority'], string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const priorityIcons: Record<Task['priority'], React.ReactNode> = {
  low: <Check className="w-3 h-3" />,
  medium: <Clock className="w-3 h-3" />,
  high: <AlertCircle className="w-3 h-3" />,
};

/** Initialise the edit form from a task, including the `yyyy-mm-dd` date input. */
export function taskToEditValues(task: Task): TaskEditFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
  };
}

/**
 * The Trello-style task detail modal.
 *
 * Opens over the board without navigating, so the column layout, scroll position
 * and the in-flight drag state behind it are all still exactly where the reader
 * left them.
 *
 * Scrolling is split: the dialog is capped to the viewport and its body scrolls
 * independently, so a long description or a long comment thread never pushes the
 * title or the comment box off screen.
 */
export function TaskDetailModal({
  task,
  columns,
  members,
  role,
  currentUserId,
  currentUserName,
  currentUserPhotoURL,
  canEdit,
  onCloseAction,
  onSaveAction,
  onSaveAssigneesAction,
  onArchiveAction,
  onRestoreAction,
  onRequestDeleteAction,
}: TaskDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskEditFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);

  const archived = task ? isArchived(task) : false;
  const mayArchive = canArchiveTasks(role);

  // Reset when a different task opens, so edit state never leaks between tasks.
  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
    setAssigneeError(null);
  }, [task?.id]);

  // Stop the board scrolling behind the dialog, and close on Escape.
  useEffect(() => {
    if (!task) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        if (editing) setEditing(false);
        else onCloseAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [task, onCloseAction, editing, saving]);

  const column = useMemo(
    () => columns.find((candidate) => candidate.id === task?.columnId) ?? null,
    [columns, task?.columnId],
  );

  const assignees = useMemo(() => {
    if (!task) return [];
    const ids = task.assigneeIds ?? [];
    if (ids.length > 0) {
      return ids.map((uid, index) => ({
        uid,
        name: task.assigneeNames?.[index] || 'Unknown user',
      }));
    }
    return task.assigneeId
      ? [{ uid: task.assigneeId, name: task.assigneeName || 'Unknown user' }]
      : [];
  }, [task]);

  if (!task) return null;

  const startEditing = () => {
    setDraft(taskToEditValues(task));
    setSaveError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveAction(task.id, draft);
      setEditing(false);
      setDraft(null);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  };

  const changeAssignees = async (uids: string[]) => {
    setAssigneeError(null);
    try {
      await onSaveAssigneesAction(task.id, uids);
    } catch (cause) {
      setAssigneeError(cause instanceof Error ? cause.message : 'Could not change assignees.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onCloseAction} />

      <div className="relative bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl sm:my-4 flex flex-col max-h-[100dvh] sm:max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            {editing ? (
              <input
                type="text"
                value={draft?.title ?? ''}
                onChange={(event) =>
                  setDraft((current) => (current ? { ...current, title: event.target.value } : current))
                }
                aria-label="Task title"
                autoFocus
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-lg font-bold focus:outline-none focus:border-gray-400"
              />
            ) : (
              <h2 className="font-mono font-bold text-lg sm:text-xl text-gray-900 break-words">
                {task.title}
              </h2>
            )}

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${priorityStyles[task.priority]}`}
              >
                {priorityIcons[task.priority]}
                <span className="ml-1 capitalize">{task.priority}</span>
              </span>
              {column && (
                <span className="font-mono text-[11px] text-gray-500">{column.name}</span>
              )}
              {archived && (
                <span className="font-mono text-[11px] text-gray-600 border border-gray-300 rounded px-1.5 py-0.5">
                  Archived {formatDate(task.archivedAt)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseAction}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Close task"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {archived && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <Archive className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="font-mono text-xs text-gray-600">
                This task is archived. {daysUntilArchiveExpiry(task) ?? 0} day(s) left before it
                becomes eligible for permanent deletion.
              </p>
            </div>
          )}

          {/* Description */}
          <section>
            <h3 className="font-mono font-bold text-gray-900 mb-2">Description</h3>
            {editing ? (
              <textarea
                value={draft?.description ?? ''}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                rows={5}
                aria-label="Task description"
                placeholder="Add more detail..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400 resize-y"
              />
            ) : task.description ? (
              <p className="text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm font-mono text-gray-400 italic">No description.</p>
            )}
          </section>

          {/* Due date */}
          <section>
            <h3 className="font-mono font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              Due date
            </h3>
            {editing ? (
              <input
                type="date"
                value={draft?.dueDate ?? ''}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, dueDate: event.target.value } : current,
                  )
                }
                aria-label="Due date"
                className="px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400"
              />
            ) : task.dueDate ? (
              <p className="text-sm font-mono text-gray-700">{formatDate(task.dueDate)}</p>
            ) : (
              <p className="text-sm font-mono text-gray-400 italic">No due date.</p>
            )}
          </section>

          {/* Priority, only editable here — mirrors the board's own field */}
          {editing && (
            <section>
              <h3 className="font-mono font-bold text-gray-900 mb-2">Priority</h3>
              <select
                value={draft?.priority ?? 'medium'}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, priority: event.target.value as Task['priority'] }
                      : current,
                  )
                }
                aria-label="Priority"
                className="px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </section>
          )}

          {/* Assignees */}
          <section>
            <h3 className="font-mono font-bold text-gray-900 mb-2">Assignees</h3>
            <AssigneePicker
              members={members}
              selected={assignees.map((assignee) => assignee.uid)}
              onChange={(uids) => void changeAssignees(uids)}
              disabled={!canEdit || saving}
            />
            {assigneeError && (
              <p className="mt-1 text-xs font-mono text-red-600" role="alert">
                {assigneeError}
              </p>
            )}
            {!canEdit && assignees.length === 0 && (
              <p className="text-sm font-mono text-gray-400 italic">Nobody assigned.</p>
            )}
          </section>

          {/* Attachments */}
          <AttachmentSection
            taskId={task.id}
            workspaceId={task.workspaceId}
            boardId={task.boardId}
            role={role}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />

          {/* Comments */}
          <CommentSection
            taskId={task.id}
            role={role}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserPhotoURL={currentUserPhotoURL}
          />

          {/* Tags, when a task actually has any */}
          {task.tags.length > 0 && (
            <section>
              <h3 className="font-mono font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-gray-100 border border-gray-300 font-mono text-[11px] text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {saveError && (
            <p className="text-xs font-mono text-red-600" role="alert">
              {saveError}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            {mayArchive &&
              (archived ? (
                <button
                  type="button"
                  onClick={() => onRestoreAction(task)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-3 py-2 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-800 hover:bg-white transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onArchiveAction(task)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-3 py-2 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-800 hover:bg-white transition-colors disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
              ))}
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                    setSaveError(null);
                  }}
                  disabled={saving}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !draft?.title.trim()}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg font-mono font-bold text-xs border-2 border-black hover:bg-white hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving' : 'Save changes'}</span>
                </button>
              </>
            ) : (
              canEdit && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg font-mono font-bold text-xs border-2 border-black hover:bg-white hover:text-black transition-all duration-200"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )
            )}

            {mayArchive && (
              <button
                type="button"
                onClick={() => onRequestDeleteAction(task)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 border-2 border-red-200 rounded-lg font-mono font-bold text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes taskyModalIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: taskyModalIn 0.18s ease-out;
        }
      `}</style>
    </div>
  );
}