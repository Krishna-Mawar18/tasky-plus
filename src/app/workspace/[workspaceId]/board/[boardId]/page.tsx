'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceRoleProvider, useWorkspaceRole } from '@/contexts/WorkspaceRoleContext';
import { boardService, taskService } from '@/lib/services';
import { Board, Task, TaskOrderUpdate } from '@/types';
import { DEFAULT_COLUMNS, statusForColumn, neighbourColumnId, tasksInColumn } from '@/lib/taskOrder';
import { isWorkspaceReadOnly } from '@/lib/permissions';
import { KanbanBoard } from '@/components/KanbanBoard';
import { 
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Edit,
  Trash2,
  Circle,
  AlertCircle,
  Eye,
  X
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
  const { loading: roleLoading, can, role } = useWorkspaceRole();
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

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
    });
    setShowEditTaskModal(true);
  };

  const handleUpdateTask = async () => {
    if (readOnly || !editingTask || !newTask.title.trim()) return;

    const taskData = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
    };

    // Store original task for rollback
    const originalTask = { ...editingTask };

    // Optimistic update - update UI immediately
    setTasks(prev => prev.map(task => 
      task.id === editingTask.id 
        ? { ...task, ...taskData }
        : task
    ));

    // Reset form and close modal immediately
    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
    setEditingTask(null);
    setShowEditTaskModal(false);

    try {
      // Update database in background
      await taskService.updateTask(editingTask.id, taskData);
    } catch (error) {
      console.error('Error updating task:', error);
      // Rollback on error
      setTasks(prev => prev.map(task => 
        task.id === originalTask.id 
          ? originalTask
          : task
      ));
      toast.error('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (readOnly) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setTaskToDelete(task);
      setShowDeleteConfirmModal(true);
    }
  };

  const confirmDeleteTask = async () => {
    if (readOnly || !taskToDelete) return;

    // Store task for potential rollback
    const deletedTask = { ...taskToDelete };

    // Optimistic update - remove from UI immediately
    setTasks(prev => prev.filter(task => task.id !== taskToDelete.id));
    
    // Close modal and reset state immediately
    setShowDeleteConfirmModal(false);
    setTaskToDelete(null);

    try {
      // Delete from database in background
      await taskService.deleteTask(deletedTask.id);
    } catch (error) {
      console.error('Error deleting task:', error);
      // Rollback on error - add task back
      setTasks(prev => [...prev, deletedTask]);
      toast.error('Failed to delete task. Please try again.');
    }
  };

  const cancelDeleteTask = () => {
    setShowDeleteConfirmModal(false);
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
          tasks={tasks}
          onTasksMove={handleTasksMove}
          avatar={<UserAvatar />}
          readOnly={readOnly}
          createTaskColumnId={showCreateTask}
          onToggleCreate={(columnId) =>
            setShowCreateTask((current) => (current === columnId ? null : columnId))
          }
          onTaskEdit={handleEditTask}
          onTaskDelete={handleDeleteTask}
          onTaskStep={handleTaskStep}
          renderCreateForm={renderCreateForm}
        />
      </div>



      {/* Edit Board Modal */}
      <EditBoardModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        board={board}
        onSubmit={handleEditBoard}
      />

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowEditTaskModal(false);
              setEditingTask(null);
              setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono">Edit Task</h2>
                  <p className="text-sm text-gray-600 font-mono">Update task details</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditTaskModal(false);
                  setEditingTask(null);
                  setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Enter task description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black-200 font-mono text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-mono font-bold text-black mb-2">
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={newTask.dueDate || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white cursor-pointer focus:bg-blue-50/30"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  onClick={handleUpdateTask}
                  disabled={!newTask.title.trim()}
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Update Task</span>
                </button>
                <button
                  onClick={() => {
                    setShowEditTaskModal(false);
                    setEditingTask(null);
                    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
                  }}
                  className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-red-200 hover:text-red-500 hover:border-red-500 border-2 border-gray-300 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && taskToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/20">
          {/* Backdrop */}
          <div 
            className="absolute inset-0"
            onClick={cancelDeleteTask}
          />
          
          {/* Modal */}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn border border-white/20">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono text-gray-900">Delete Task</h2>
                  <p className="text-sm text-gray-600 font-mono">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={cancelDeleteTask}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-700 font-mono mb-4">
                  Are you sure you want to delete this task?
                </p>
                
                {/* Task Preview */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-mono font-bold text-gray-900 mb-2">
                    &quot;{taskToDelete.title}&quot;
                  </h3>
                  {taskToDelete.description && (
                    <p className="text-sm text-gray-600 font-mono mb-2">
                      {taskToDelete.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full font-mono text-xs ${priorityColors[taskToDelete.priority]}`}>
                      {priorityIcons[taskToDelete.priority]}
                      <span className="ml-1 capitalize">{taskToDelete.priority}</span>
                    </span>
                    {taskToDelete.dueDate && (
                      <span className="text-xs text-gray-500 font-mono">
                        Due: {new Date(taskToDelete.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={confirmDeleteTask}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-red-200 hover:text-red-500 hover:border-red-500 border-2 border-red-500 transition-all duration-200 flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
