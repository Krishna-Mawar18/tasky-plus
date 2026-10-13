'use client';

import { useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { Task, WorkspaceRole } from '@/types';
import { canArchiveTasks } from '@/lib/permissions';
import { ARCHIVE_RETENTION_DAYS, daysUntilArchiveExpiry } from '@/lib/taskArchive';
import { formatDate } from '@/lib/datetime';

interface ArchivedTasksPanelProps {
  tasks: Task[];
  role: WorkspaceRole | null;
  restoringId: string | null;
  onRestoreAction: (task: Task) => void;
  onRequestDeleteAction: (task: Task) => void;
}

/**
 * The board's Archived section.
 *
 * Archived tasks are not a separate collection and not a different board: they
 * are the same documents, hidden from the columns and listed here. Collapsed by
 * default so a workspace with a long archive history does not dominate the page.
 *
 * Restore and permanent delete are only drawn for roles that hold `task.archive`.
 * A viewer sees the list and neither button — and the write behind each button is
 * refused by the Firestore rules regardless of what the UI shows.
 */
export function ArchivedTasksPanel({
  tasks,
  role,
  restoringId,
  onRestoreAction,
  onRequestDeleteAction,
}: ArchivedTasksPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const mayArchive = canArchiveTasks(role);

  // Newest archive first, then by title so equal timestamps stay stable.
  const ordered = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const left = a.archivedAt?.getTime() ?? 0;
        const right = b.archivedAt?.getTime() ?? 0;
        if (left !== right) return right - left;
        return a.title.localeCompare(b.title);
      }),
    [tasks],
  );

  if (ordered.length === 0) return null;

  return (
    <section className="mt-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Archive className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-mono font-bold text-gray-900">Archived</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono text-xs font-bold">
            {ordered.length}
          </span>
        </span>
        <span className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:inline font-mono text-[11px] text-gray-500">
            Permanently deleted {ARCHIVE_RETENTION_DAYS} days after archiving
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-100">
            {ordered.map((task) => {
              const daysLeft = daysUntilArchiveExpiry(task);
              return (
                <li
                  key={task.id}
                  className="px-4 sm:px-5 py-3 flex items-center gap-4 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-gray-900 truncate">{task.title}</p>
                    <p className="font-mono text-[11px] text-gray-500 mt-0.5">
                      Archived {formatDate(task.archivedAt)}
                      {task.dueDate ? ` · was due ${formatDate(task.dueDate)}` : ''}
                      {task.assigneeNames && task.assigneeNames.length > 0
                        ? ` · ${task.assigneeNames.join(', ')}`
                        : task.assigneeName
                          ? ` · ${task.assigneeName}`
                          : ''}
                    </p>
                    {daysLeft !== null && daysLeft <= 14 && (
                      <p className="font-mono text-[11px] text-amber-700 mt-0.5">
                        {daysLeft === 0
                          ? 'Eligible for permanent deletion.'
                          : `${daysLeft} day(s) until permanent deletion.`}
                      </p>
                    )}
                  </div>

                  {mayArchive && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onRestoreAction(task)}
                        disabled={restoringId === task.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoringId === task.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRequestDeleteAction(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-red-200 rounded-lg font-mono font-bold text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete permanently</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="px-4 sm:px-5 py-3 border-t border-gray-200 bg-gray-50 font-mono text-[11px] text-gray-500">
            Tasks are permanently deleted {ARCHIVE_RETENTION_DAYS} days after archiving.
          </p>
        </div>
      )}
    </section>
  );
}