'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceRoleProvider, useWorkspaceRole } from '@/contexts/WorkspaceRoleContext';
import { boardService, memberService, taskService } from '@/lib/services';
import { Board, Task, TaskOrderUpdate, WorkspaceMember } from '@/types';
import { DEFAULT_COLUMNS, statusForColumn, neighbourColumnId, tasksInColumn } from '@/lib/taskOrder';
import { isWorkspaceReadOnly } from '@/lib/permissions';
import { activeTasks, archivedTasks } from '@/lib/taskArchive';
import { KanbanBoard } from '@/components/KanbanBoard';
import { ArchivedTasksPanel } from '@/components/ArchivedTasksPanel';
import { TaskDetailModal, type TaskEditFormValues } from '@/components/task/TaskDetailModal';
import { ConfirmDialog } from '@/components/task/ConfirmDialog';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Edit,
  Circle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import EditBoardModal from '../../../../../components/EditBoardModal';
import Image from 'next/image';

/** Apply persisted move results to local state. Pure, so it is easy to reason about. */
function applyOrderUpdates(tasks: Task[], updates: TaskOrderUpdate[]): Task[] {
  if (updates.length === 0) return tasks;

  const byId = new Map(updates.map((update) => [update.taskId, update]));
  return tasks.map((task) => {
    const update = byId.get(task.id);
    if (!update) return task;
    return {
      ...task,
      columnId: update.columnId,
      order: update.order,
      ...(update.status ? { status: update.status } : {}),
    };
  });
}

export default function BoardPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  return (
    <WorkspaceRoleProvider workspaceId={workspaceId}>
      <BoardContent />
    </WorkspaceRoleProvider>
  );
}

function BoardContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;
  const { loading: roleLoading, can, role, isMember } = useWorkspaceRole();
  // One gate for every board and task write, so the same rule that hides a
  // control also blocks the write behind it. True while the role is unresolved,
  // which is what stops a viewer's page from flashing owner controls.
  const canEditBoard = can('board.edit');
  const readOnly = isWorkspaceReadOnly(role);

  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  /** The task whose detail modal is open. `null` when the modal is closed. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** The task awaiting permanent-delete confirmation. */
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [restoringTaskId, setRestoringTaskId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  /**
   * Sequence number of the most recent move touching each task. A rollback is
   * applied per task only while no newer drag has superseded it, so a slow
   * write can never clobber a newer one.
   */
  const taskSequence = useRef(new Map<string, number>());
  const moveCounter = useRef(0);

  // Mirror of `tasks` so the move handler can snapshot outside of a state
  // updater, which must stay free of side effects.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Boards created before columns were stored fall back to the defaults, which
  // is exactly the layout this page has always rendered.
  const columns = useMemo(
    () => (board?.columns?.length ? board.columns : DEFAULT_COLUMNS),
    [board],
  );

  /**
   * The board renders active tasks; archived ones live in the panel below.
   *
   * Derived rather than stored separately so both views can never disagree: there
   * is one `tasks` array and one place that decides which list a task belongs in.
   */
  const visibleTasks = useMemo(() => activeTasks(tasks), [tasks]);
  const archived = useMemo(() => archivedTasks(tasks), [tasks]);

  /**
   * The task the modal is showing.
   *
   * Read from `tasks` by id rather than snapshotted, so an edit made inside the
   * modal is reflected immediately without a second copy of the task to keep in
   * sync. Closing is just `openTaskId = null`.
   */
  const openTask = useMemo(
    () => (openTaskId ? tasks.find((task) => task.id === openTaskId) ?? null : null),
    [openTaskId, tasks],
  );

  const priorityColors = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-red-100 text-red-700 border-red-200'
  };

  const priorityIcons = {
    low: <Circle className="w-3 h-3" />,
    medium: <Clock className="w-3 h-3" />,
    high: <AlertCircle className="w-3 h-3" />
  };

  useEffect(() => {
    if (!user || !boardId) return;

    const loadBoardData = async () => {
      try {
        // Load board details
        const boardData = await boardService.getBoard(boardId);
        setBoard(boardData);

        // Load tasks for this board
        const boardTasks = await taskService.getTasksByBoard(boardId);
        setTasks(boardTasks);

        // Repair documents written before task ordering existed. The board is
        // already rendered correctly from the in-memory fallback sort, so this
        // runs quietly in the background.
        void taskService.migrateMissingTaskOrders(boardTasks);
      } catch (error) {
        console.error('Error loading board data:', error);
        toast.error('Could not load this board. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadBoardData();
  }, [user, boardId]);

  /**
   * Workspace members, for the assignee picker.
   *
   * Only assignable people come from this list, so a task can never be assigned
   * to somebody outside the workspace. Subscribed rather than fetched so a
   * person added later can be assigned without reloading the board.
   */
  useEffect(() => {
    if (roleLoading || !isMember) return;

    const unsubscribe = memberService.subscribeToMembers(
      workspaceId,
      setMembers,
      (error) => console.error('Could not load workspace members:', error),
    );

    return unsubscribe;
  }, [workspaceId, roleLoading, isMember]);

  const handleCreateTask = async (columnId: string) => {
    if (readOnly || !user || !board || !newTask.title.trim()) return;

    const status = statusForColumn(columnId, columns);

    // The board is already in memory, so the new task's position is known
    // without another read.
    const columnTasks = tasksInColumn(tasks, columnId);
    const lastOrder = columnTasks[columnTasks.length - 1];
    const order = lastOrder ? lastOrder.order + 1000 : 1000;

    const taskData = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      columnId,
      boardId: board.id,
      workspaceId,
      assigneeId: user.uid,
      assigneeName: user.displayName || user.email || 'Unknown',
      priority: newTask.priority,
      status,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
      tags: []
    };

    // Optimistic task, positioned at the end of the column it was created in.
    const tempTask: Task = {
      ...taskData,
      id: `temp-${Date.now()}`,
      order,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Reset form and close modal immediately
    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
    setShowCreateTask(null);

    // Optimistic update - add task to UI immediately
    setTasks(prev => [...prev, tempTask]);

    try {
      // Create task in database
      const createdTaskId = await taskService.createTask(taskData);

      // Replace temp task with real task (using the returned ID)
      setTasks(prev => prev.map(task =>
        task.id === tempTask.id ? { ...task, id: createdTaskId } : task
      ));
    } catch (error) {
      console.error('Error creating task:', error);
      // Remove temp task on error
      setTasks(prev => prev.filter(task => task.id !== tempTask.id));
      toast.error('Failed to create task. Please try again.');
    }
  };

  /**
   * Apply a completed drag: update local state immediately, persist, and put
   * the board back exactly as it was if the write fails.
   */
  const handleTasksMove = useCallback(async (updates: TaskOrderUpdate[]) => {
    // Belt-and-braces: the board is rendered without sensors when read-only, so
    // this only guards against a move arriving from anywhere else.
    if (readOnly) return;

    const stamp = ++moveCounter.current;
    const stamps = new Map(updates.map((update) => [update.taskId, stamp]));
    updates.forEach((update) => taskSequence.current.set(update.taskId, stamp));

    // Snapshot only the fields the move overwrites, so a rollback cannot
    // discard an edit made while the write was in flight.
    const current = tasksRef.current;
    const snapshot = new Map<string, Pick<Task, 'columnId' | 'order' | 'status'>>();
    updates.forEach(({ taskId }) => {
      const task = current.find((candidate) => candidate.id === taskId);
      if (task) {
        snapshot.set(taskId, {
          columnId: task.columnId,
          order: task.order,
          status: task.status,
        });
      }
    });

    // Optimistic: the board re-renders in its new position immediately.
    setTasks((previous) => applyOrderUpdates(previous, updates));

    try {
      await taskService.applyTaskMoves(updates);
    } catch (error) {
      console.error('Error saving task position:', error);
      setTasks((previous) =>
        previous.map((task) => {
          const original = snapshot.get(task.id);
          // Only revert tasks that have not been moved again since.
          if (!original || taskSequence.current.get(task.id) !== stamps.get(task.id)) {
            return task;
          }
          return { ...task, ...original };
        }),
      );
      // Single owner of failure reporting: the board must not also toast, or
      // the user sees the same message twice.
      toast.error('Failed to save the new task position. The board has been restored.');
    }
  }, [readOnly]);

  const handleTaskStep = async (taskId: string, direction: -1 | 1) => {
    if (readOnly) return;
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const targetColumnId = neighbourColumnId(task.columnId, columns, direction);
    if (!targetColumnId) return;

    // Stepping to a neighbouring column always lands at the end of it.
    const destination = tasksInColumn(tasks, targetColumnId);
    const last = destination[destination.length - 1];
    const status = statusForColumn(targetColumnId, columns);

    await handleTasksMove([
      {
        taskId,
        columnId: targetColumnId,
        order: last ? last.order + 1000 : 1000,
        ...(status === task.status ? {} : { status })
      },
    ]);
  };

  const handleEditBoard = async (data: { name: string; description: string }) => {
    if (readOnly || !board) return;
    
    try {
      await boardService.updateBoard(board.id, data);
      setBoard(prev => prev ? { ...prev, ...data } : null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating board:', error);
    }
  };

  /** Open the detail modal on a card click. Allowed even for viewers. */
  const handleOpenTask = (task: Task) => {
    setOpenTaskId(task.id);
  };

  /**
   * Persist an edit made inside the modal.
   *
   * Kept optimistic, matching how the board has always treated a task write: the
   * card updates immediately and is restored if Firestore rejects the change. The
   * modal only leaves edit mode once the write resolves, so a failed save leaves
   * the reader looking at their unsaved text instead of a silently discarded edit.
   */
  const handleSaveTask = async (taskId: string, values: TaskEditFormValues) => {
    if (readOnly) throw new Error('Your role cannot edit tasks.');

    const taskData = {
      title: values.title.trim(),
      description: values.description.trim(),
      priority: values.priority,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
    };

    const previous = tasks.find((task) => task.id === taskId);
    if (!previous) throw new Error('That task is no longer on this board.');

    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, ...taskData } : task)),
    );

    try {
      await taskService.updateTask(taskId, taskData);
    } catch (error) {
      console.error('Error updating task:', error);
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? previous : task)),
      );
      throw error;
    }
  };

  /**
   * Change assignees from inside the modal.
   *
   * The optimistic update mirrors the first assignee into the legacy single
   * fields so the card, the stats service and the assignment notifications keep
   * working unchanged; `setAssignees` writes the same pairing server-side.
   */
  const handleSaveAssignees = async (taskId: string, uids: string[]) => {
    if (readOnly) throw new Error('Your role cannot assign tasks.');

    const previous = tasks.find((task) => task.id === taskId);
    if (!previous) throw new Error('That task is no longer on this board.');

    // Resolve names from the member list once, and pass the same pairing to the
    // optimistic update and to the write, so the two cannot disagree.
    const resolved = uids.map((uid) => {
      const member = members.find((candidate) => candidate.uid === uid);
      return { uid, name: member?.displayName || member?.email || 'Unknown user' };
    });

    const optimistic = {
      assigneeIds: resolved.map((entry) => entry.uid),
      assigneeNames: resolved.map((entry) => entry.name),
      assigneeId: resolved[0]?.uid,
      assigneeName: resolved[0]?.name,
    };

    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, ...optimistic } : task)),
    );

    try {
      await taskService.setAssignees(taskId, resolved);
    } catch (error) {
      console.error('Error updating assignees:', error);
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? previous : task)),
      );
      throw error;
    }
  };

  /**
   * Hide a task without deleting it.
   *
   * An archive is reversible, so it is the action offered first and the archive
   * timestamp is written immediately. `archivedBy` is the current user, which is
   * what makes "archived 3 days ago by someone" answerable later.
   */
  const handleArchiveTask = async (task: Task) => {
    if (readOnly || !user) return;

    const archivedAt = new Date();
    const previous = tasks.find((candidate) => candidate.id === task.id);

    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, archived: true, archivedAt, archivedBy: user.uid }
          : candidate,
      ),
    );
    setOpenTaskId(null);

    try {
      await taskService.archiveTask(task.id, user.uid);
      toast.success('Task archived.');
    } catch (error) {
      console.error('Error archiving task:', error);
      if (previous) {
        setTasks((current) =>
          current.map((candidate) => (candidate.id === task.id ? previous : candidate)),
        );
      }
      toast.error('Failed to archive task. Please try again.');
    }
  };

  /**
   * Put an archived task back on the board.
   *
   * The column is resolved here for the optimistic update and passed to the
   * service as the full column list, so the service applies the same
   * "original column, else the first one" rule and the card never lands somewhere
   * the write did not put it.
   */
  const handleRestoreTask = async (task: Task) => {
    if (readOnly || !user) return;

    const targetColumnId =
      columns.find((column) => column.id === task.columnId)?.id ?? columns[0]?.id;
    if (!targetColumnId) {
      toast.error('This board has no columns to restore into.');
      return;
    }

    const previous = tasks.find((candidate) => candidate.id === task.id);
    const restored = { archived: false, archivedAt: null, archivedBy: null };

    setRestoringTaskId(task.id);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, ...restored, columnId: targetColumnId }
          : candidate,
      ),
    );

    try {
      await taskService.restoreTask(task.id, columns);
      setRestoringTaskId(null);
      toast.success('Task restored.');
    } catch (error) {
      console.error('Error restoring task:', error);
      if (previous) {
        setTasks((current) =>
          current.map((candidate) => (candidate.id === task.id ? previous : candidate)),
        );
      }
      setRestoringTaskId(null);
      toast.error('Failed to restore task. Please try again.');
    }
  };

  /**
   * Ask before deleting.
   *
   * Every path into permanent deletion goes through here — the modal's Delete
   * button and the archived panel — so the warning cannot be skipped. Takes the
   * task itself rather than an id because the archived panel already holds one.
   */
  const handleDeleteTask = (task: Task) => {
    if (readOnly) return;
    setTaskToDelete(task);
  };

  /**
   * Permanent deletion, including the task's comments and attachment metadata.
   *
   * Optimistic removal with rollback, as before. `deleteTaskCascade` removes the
   * collaboration subcollections as well; if a subcollection delete fails the
   * task itself is left alone rather than half-deleted, so the rollback below has
   * something to put back.
   */
  const confirmDeleteTask = async () => {
    if (readOnly || !taskToDelete) return;

    const deletedTask = { ...taskToDelete };

    setDeletingTask(true);
    setTasks((prev) => prev.filter((task) => task.id !== deletedTask.id));
    setOpenTaskId((current) => (current === deletedTask.id ? null : current));
    setTaskToDelete(null);

    try {
      const report = await taskService.deleteTaskCascade(deletedTask.id);
      setDeletingTask(false);

      // Surfaces any object the storage layer could not remove. With no storage
      // configured `pending` is empty, but Phase 2 needs this to stay visible so a
      // partial delete is never reported as a clean one.
      if (report.storage.pending.length > 0) {
        toast.error(
          `Task deleted, but ${report.storage.pending.length} file(s) need manual cleanup: ${report.storage.pending.join(', ')}`,
          { duration: 8000 },
        );
      } else {
        toast.success('Task permanently deleted.');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setTasks((prev) => [...prev, deletedTask]);
      setDeletingTask(false);
      toast.error('Failed to delete task. Please try again.');
    }
  };

  const cancelDeleteTask = () => {
    if (deletingTask) return;
    setTaskToDelete(null);
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-gray-800 mb-4">Board not found</h1>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  const UserAvatar = () => {
    if (!user?.photoURL || imageError) {
      const userInitials = user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
      return (
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">{userInitials}</span>
        </div>
      );
    }

    return (
      <Image
        src={user.photoURL}
        alt={user.displayName || 'User'}
        width={32}
        height={32}
        className="rounded-full"
        onError={() => setImageError(true)}
        priority
      />
    );
  };

  const renderCreateForm = (columnId: string) => (
    <div className="mb-4 p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 shadow-sm">
      {/* Task Title Input */}
      <div className="mb-3">
        <div className="relative">
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTask.title.trim()) {
                e.preventDefault();
                handleCreateTask(columnId);
              }
            }}
            placeholder="What needs to be done?"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black-400 focus:border-black-200 transition-all duration-200 bg-white/80 backdrop-blur-sm placeholder:text-gray-400"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Description Input */}
      <div className="mb-4">
        <textarea
          value={newTask.description}
          onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Add more details..."
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black-400 focus:border-black-200 transition-all duration-200 bg-white/80 backdrop-blur-sm resize-none placeholder:text-gray-400"
          rows={2}
        />
      </div>

      {/* Priority and Due Date Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Priority Selector */}
        <div>
          <label className="block text-xs font-bold font-mono text-gray-600 mb-1 uppercase tracking-wide">
            Priority
          </label>
          <div className="relative">
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white appearance-none cursor-pointer"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Due Date Picker */}
        <div>
          <label className="block text-xs font-bold font-mono text-gray-600 mb-1 uppercase tracking-wide">
            Due Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={newTask.dueDate || ''}
              onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white cursor-pointer focus:bg-blue-50/30"
            />
            <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-1 text-xs text-gray-500 font-mono">
          
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateTask(null)}
            className="px-4 py-2 text-gray-600 border-2 border-gray-200 hover:text-red-500 hover:border-red-500 hover:bg-red-200 text-sm font-mono font-medium hover:bg-gray-100 rounded-lg transition-all duration-200 flex items-center space-x-1"
          >
            <span>Cancel</span>
          </button>
          <button
            onClick={() => handleCreateTask(columnId)}
            disabled={!newTask.title.trim()}
            className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-2"
              >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-[60]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <button
                onClick={() => router.push(`/workspace/${workspaceId}`)}
                className="group relative overflow-hidden flex items-center justify-center px-2 py-2 sm:px-3 sm:py-3 bg-white/80 hover:bg-black text-gray-800 hover:text-white rounded-xl sm:rounded-2xl transition-all duration-500 hover:scale-110 hover:shadow-2xl border border-gray-300 hover:border-black backdrop-blur-md hover:backdrop-blur-xl flex-shrink-0"
              >
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-black via-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl sm:rounded-2xl"></div>
                
                {/* Content */}
                <div className="relative z-10 flex items-center justify-center space-x-1 sm:space-x-2">
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:scale-110" />
                  <span className="font-mono font-bold text-xs sm:text-sm opacity-0 sm:group-hover:opacity-100 transition-all duration-300 delay-100 transform translate-x-2 group-hover:translate-x-0 hidden sm:inline">
                    Workspace
                  </span>
                </div>
                
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </div>
              </button>
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <span className="text-gray-400 font-bold hidden sm:inline">|</span>
                <h1 className="text-lg sm:text-xl font-mono font-bold text-black truncate">{board.name}</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {canEditBoard && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-black text-white px-2 py-2 sm:px-4 sm:py-2 rounded-lg font-mono font-bold text-xs sm:text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-1 sm:space-x-2"
                  title="Edit board"
                >
                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Edit Board</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {readOnly && (
        <div className="px-6 pt-4 relative z-[50]">
          <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-white/90 border-2 border-gray-200 shadow-lg">
            <Eye className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <p className="text-sm font-mono text-gray-600">
              {role === 'viewer'
                ? 'Viewer access: you can read this board but cannot create, edit or move tasks.'
                : 'Read-only access for your role.'}
            </p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="p-6 relative z-[50]">
        <KanbanBoard
          columns={columns}
          tasks={visibleTasks}
          onTasksMove={handleTasksMove}
          avatar={<UserAvatar />}
          readOnly={readOnly}
          createTaskColumnId={showCreateTask}
          onToggleCreate={(columnId) =>
            setShowCreateTask((current) => (current === columnId ? null : columnId))
          }
          onTaskStep={handleTaskStep}
          onTaskOpen={handleOpenTask}
          renderCreateForm={renderCreateForm}
        />

        <ArchivedTasksPanel
          tasks={archived}
          role={role}
          restoringId={restoringTaskId}
          onRestore={(task) => void handleRestoreTask(task)}
          onRequestDelete={handleDeleteTask}
        />
      </div>



      {/* Edit Board Modal */}
      <EditBoardModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        board={board}
        onSubmit={handleEditBoard}
      />

      {/*
        One modal for reading and editing a task. It replaced the separate
        edit-only dialog: everything now lands here, a card click in read mode
        and the modal's own Edit button in edit mode.
      */}
      <TaskDetailModal
        task={openTask}
        columns={columns}
        members={members}
        role={role}
        currentUserId={user?.uid ?? null}
        currentUserName={user?.displayName || 'Unknown user'}
        currentUserPhotoURL={user?.photoURL ?? null}
        canEdit={!readOnly}
        onClose={() => setOpenTaskId(null)}
        onSave={handleSaveTask}
        onSaveAssignees={handleSaveAssignees}
        onArchive={(task) => void handleArchiveTask(task)}
        onRestore={(task) => void handleRestoreTask(task)}
        onRequestDelete={handleDeleteTask}
      />

      {/*
        Permanent deletion, shared by the modal's Delete button and the archived
        panel. `taskToDelete` is set by both, so there is one confirmation and one
        code path to the cascade delete.
      */}
      <ConfirmDialog
        isOpen={taskToDelete !== null}
        title={taskToDelete?.archived ? 'Delete archived task permanently?' : 'Delete task permanently?'}
        subtitle="This action cannot be undone"
        tone="danger"
        confirmLabel="Delete permanently"
        busyLabel="Deleting..."
        busy={deletingTask}
        onCancel={cancelDeleteTask}
        onConfirm={() => void confirmDeleteTask()}
      >
        <p className="text-sm font-mono text-gray-700 mb-3">
          &quot;{taskToDelete?.title}&quot; will be deleted along with its comments and
          attachment records. This cannot be undone.
        </p>

        {taskToDelete && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full font-mono text-xs ${priorityColors[taskToDelete.priority]}`}>
                {priorityIcons[taskToDelete.priority]}
                <span className="ml-1 capitalize">{taskToDelete.priority}</span>
              </span>
              {taskToDelete.archived && (
                <span className="text-xs font-mono text-gray-500">
                  Archived {taskToDelete.archivedAt ? new Date(taskToDelete.archivedAt).toLocaleDateString() : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {taskToDelete?.archived && (
          <p className="mt-3 text-xs font-mono text-gray-500">
            This task is archived, so it would have been deleted automatically after 90 days
            anyway. Deleting it now does that immediately.
          </p>
        )}
      </ConfirmDialog>

      {/* Animations */}
      <style jsx global>{`
        @keyframes blob1 { 
          0%, 100% {
            transform: scale(1) translateY(0) rotate(0deg); 
          } 
          50% {
            transform: scale(1.1) translateY(20px) rotate(5deg); 
          } 
        }
        .animate-blob1 { 
          animation: blob1 8s ease-in-out infinite; 
        }
        @keyframes blob2 { 
          0%, 100% {
            transform: scale(1) translateY(0) rotate(0deg); 
          } 
          50% {
            transform: scale(1.05) translateY(-20px) rotate(-5deg); 
          } 
        }
        .animate-blob2 { 
          animation: blob2 10s ease-in-out infinite; 
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }
        
        /* Enhanced Date Input Styling */
        input[type="date"] {
          position: relative;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          position: absolute;
          right: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          z-index: 1;
        }
        
        input[type="date"]::-webkit-inner-spin-button,
        input[type="date"]::-webkit-clear-button {
          display: none;
        }
        
        input[type="date"]::-webkit-datetime-edit-fields-wrapper {
          padding: 0;
          display: flex;
          align-items: center;
        }
        
        input[type="date"]::-webkit-datetime-edit-text {
          color: #9ca3af;
          padding: 0 2px;
          font-weight: 400;
        }
        
        input[type="date"]::-webkit-datetime-edit-month-field,
        input[type="date"]::-webkit-datetime-edit-day-field,
        input[type="date"]::-webkit-datetime-edit-year-field {
          color: #374151;
          font-weight: 500;
          background: transparent;
          border: none;
          outline: none;
        }
        
        input[type="date"]:focus::-webkit-datetime-edit-month-field,
        input[type="date"]:focus::-webkit-datetime-edit-day-field,
        input[type="date"]:focus::-webkit-datetime-edit-year-field {
          color: #1f2937;
          background-color: #dbeafe;
          border-radius: 4px;
          padding: 1px 3px;
        }
        

        
        /* Placeholder styling for empty date input */
        input[type="date"]:not(:focus):invalid {
          color: #9ca3af;
        }
        
        input[type="date"]:not(:focus):invalid::-webkit-datetime-edit-fields-wrapper {
          color: #9ca3af;
        }
        
        input[type="date"]:not(:focus):invalid::before {
          content: "Select date";
          color: #9ca3af;
          font-size: 14px;
        }

      `}</style>
    </div>
  );
}
