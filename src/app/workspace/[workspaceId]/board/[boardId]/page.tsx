'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { Plus, MoreVertical, Edit, Trash2, User, Calendar, Tag, MessageSquare, ArrowLeft, AlertTriangle } from 'lucide-react';
import { boardService, taskService } from '@/lib/services';
import { Board, Task, Column } from '@/types';

interface KanbanBoardProps {
  params: Promise<{
    workspaceId: string;
    boardId: string;
  }>;
}

export default function KanbanBoardPage({ params }: KanbanBoardProps) {
  const resolvedParams = use(params);
  const { user, loading, isFirebaseConfigured } = useAuth();
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assigneeName: '',
    tags: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Default columns for new boards
  const defaultColumns: Column[] = [
    { id: 'todo', name: 'To Do', order: 1, tasks: [] },
    { id: 'in-progress', name: 'In Progress', order: 2, tasks: [] },
    { id: 'completed', name: 'Completed', order: 3, tasks: [] },
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load board and tasks
  useEffect(() => {
    if (user && isFirebaseConfigured && resolvedParams.boardId) {
      const loadBoardData = async () => {
        try {
          setIsLoading(true);
          
          // Load board
          const boards = await boardService.getBoards(resolvedParams.workspaceId);
          const currentBoard = boards.find(b => b.id === resolvedParams.boardId);
          
          if (currentBoard) {
            setBoard(currentBoard);
          } else {
            // Create new board with default columns
            const newBoard: Omit<Board, 'id' | 'createdAt' | 'updatedAt'> = {
              workspaceId: resolvedParams.workspaceId,
              name: 'New Board',
              description: 'Kanban board for task management',
              columns: defaultColumns,
            };
            const boardId = await boardService.createBoard(newBoard);
            router.push(`/workspace/${resolvedParams.workspaceId}/board/${boardId}`);
            return;
          }

          // Load tasks
          const boardTasks = await taskService.getTasks(resolvedParams.boardId);
          setTasks(boardTasks);
        } catch (error) {
          console.error('Error loading board data:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadBoardData();
    }
  }, [user, isFirebaseConfigured, resolvedParams.boardId, resolvedParams.workspaceId, router]);

  // After loading the board, if columns are missing or empty, add default columns and update the board
  useEffect(() => {
    if (board && (!Array.isArray(board.columns) || board.columns.length === 0)) {
      // Patch the board with default columns
      const patchBoard = async () => {
        try {
          await boardService.updateBoard(board.id, { columns: defaultColumns });
          setBoard({ ...board, columns: defaultColumns });
        } catch (err) {
          console.error('Failed to patch board with default columns:', err);
        }
      };
      patchBoard();
    }
  }, [board]);

  const getTasksForColumn = (columnId: string) => {
    return tasks.filter(task => task.columnId === columnId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'todo': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const handleMoveTask = async (taskId: string, newColumnId: string) => {
    try {
      console.log(`Moving task ${taskId} to column ${newColumnId}`);
      
      // Optimistically update the UI first
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, columnId: newColumnId }
          : task
      ));

      // Then update in Firebase
      await taskService.moveTask(taskId, newColumnId);
      console.log('Task moved successfully in Firebase');
    } catch (error) {
      console.error('Error moving task:', error);
      // Revert the optimistic update if Firebase fails
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, columnId: task.columnId } // Keep original columnId
          : task
      ));
      alert('Failed to move task. Please try again.');
    }
  };

    const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create task object and filter out undefined values
      const taskData: any = {
        title: taskForm.title,
        description: taskForm.description,
        status: 'todo',
        priority: taskForm.priority as 'low' | 'medium' | 'high',
        assigneeId: user?.uid || '',
        assigneeName: taskForm.assigneeName || user?.displayName || '',
        tags: taskForm.tags,
        columnId: 'todo', // Default to first column
        boardId: resolvedParams.boardId,
        workspaceId: resolvedParams.workspaceId,
      };

      // Only add dueDate if it's not empty
      if (taskForm.dueDate) {
        taskData.dueDate = new Date(taskForm.dueDate);
      }

      const taskId = await taskService.createTask(taskData);
      console.log('Task created successfully:', taskId);
      
      // Reset form and close modal
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assigneeName: '',
        tags: [],
      });
      setShowCreateTask(false);
      
      // Refresh tasks
      const boardTasks = await taskService.getTasks(resolvedParams.boardId);
      setTasks(boardTasks);
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

    const handleEditTask = async () => {
    if (!editingTask || !taskForm.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create updates object and filter out undefined values
      const updates: any = {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority as 'low' | 'medium' | 'high',
        assigneeName: taskForm.assigneeName,
        tags: taskForm.tags,
      };

      // Only add dueDate if it's not empty, otherwise set to null to clear it
      if (taskForm.dueDate) {
        updates.dueDate = new Date(taskForm.dueDate);
      } else {
        updates.dueDate = null; // Clear the due date
      }

      await taskService.updateTask(editingTask.id, updates);
      console.log('Task updated successfully');
      
      // Reset form and close modal
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assigneeName: '',
        tags: [],
      });
      setEditingTask(null);
      
      // Refresh tasks
      const boardTasks = await taskService.getTasks(resolvedParams.boardId);
      setTasks(boardTasks);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      assigneeName: task.assigneeName || '',
      tags: task.tags || [],
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      setShowDeleteConfirm(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const confirmDelete = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteConfirm(true);
  };

  // Task Component
  const TaskCard = ({ task, column }: { task: Task; column: Column }) => {
    return (
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        onClick={() => openEditModal(task)}
      >
        {/* Task Header */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-mono font-medium text-sm line-clamp-2">
            {task.title}
          </h4>
          <div className="flex items-center space-x-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(task);
              }}
              className="text-gray-400 hover:text-blue-600 p-1"
              title="Edit task"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete(task);
              }}
              className="text-gray-400 hover:text-red-600 p-1"
              title="Delete task"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Task Description */}
        {task.description && (
          <p className="text-xs text-gray-600 font-mono mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

                 {/* Task Meta */}
         <div className="flex items-center justify-between text-xs">
           <div className="flex items-center space-x-2">
             {task.assigneeName && (
               <div className="flex items-center space-x-1 text-gray-500">
                 <User className="w-3 h-3" />
                 <span className="font-mono">{task.assigneeName}</span>
               </div>
             )}
             {task.dueDate && (
               <div className="flex items-center space-x-1 text-gray-500">
                 <Calendar className="w-3 h-3" />
                 <span className="font-mono">
                   {new Date(task.dueDate).toLocaleDateString()}
                 </span>
               </div>
             )}
           </div>
           
           <div className="flex items-center space-x-2">
             <span className={`px-2 py-1 rounded-full text-xs font-mono ${getPriorityColor(task.priority)}`}>
               {task.priority}
             </span>
             {task.tags.length > 0 && (
               <div className="flex items-center space-x-1">
                 <Tag className="w-3 h-3 text-gray-400" />
                 <span className="text-gray-500 font-mono">{task.tags.length}</span>
               </div>
             )}
           </div>
         </div>

         {/* Move Task Buttons */}
         <div className="mt-3 pt-3 border-t border-gray-100">
           <div className="flex flex-wrap gap-1">
             {columns.map((col) => (
               col.id !== column.id && (
                 <button
                   key={col.id}
                   onClick={(e) => {
                     e.stopPropagation();
                     handleMoveTask(task.id, col.id);
                   }}
                   className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-mono transition-colors"
                 >
                   Move to {col.name}
                 </button>
               )
             ))}
           </div>
         </div>
      </div>
    );
  };

  // Column Component
  const ColumnCard = ({ column }: { column: Column }) => {
    const columnTasks = getTasksForColumn(column.id);

    return (
      <div className="bg-white/90 border border-gray-200 rounded-xl p-4 shadow-lg">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(column.id)}`}></div>
            <h3 className="font-mono font-bold text-lg">{column.name}</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-mono">
              {columnTasks.length}
            </span>
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3 min-h-[200px] max-h-[600px] overflow-y-auto">
          {columnTasks.map((task) => (
            <TaskCard key={task.id} task={task} column={column} />
          ))}
          
          {columnTasks.length === 0 && (
            <div className="text-center py-8 text-gray-400 font-mono">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Plus className="w-4 h-4" />
              </div>
              <p className="text-sm">No tasks yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading board...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 font-mono">Firebase Not Configured</h1>
          <p className="text-gray-600 mb-6 font-mono">Please configure Firebase to use the board.</p>
        </div>
      </div>
    );
  }

  const columns = board?.columns && board.columns.length > 0 ? board.columns : defaultColumns;

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black">
      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-mono">Back to Dashboard</span>
              </button>
              <div className="w-px h-6 bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-bold font-mono">{board?.name || 'Kanban Board'}</h1>
                <p className="text-sm text-gray-600 font-mono">{board?.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowCreateTask(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

             {/* Kanban Board */}
       <div className="p-6">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {columns.length === 0 && (
             <div className="text-center py-8 text-gray-400 font-mono">
               <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                 <AlertTriangle className="w-4 h-4 text-yellow-500" />
               </div>
               <p className="text-sm">No columns found for this board. Please refresh or contact support.</p>
             </div>
           )}
           {Array.isArray(columns) && columns.length > 0 && columns.map((column: Column) => (
             <ColumnCard key={column.id} column={column} />
           ))}
         </div>
       </div>

             {/* Create/Edit Task Modal */}
       {(showCreateTask || editingTask) && (
         <div className="fixed inset-0 z-50 flex items-center justify-center">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
             setShowCreateTask(false);
             setEditingTask(null);
             setTaskForm({
               title: '',
               description: '',
               priority: 'medium',
               dueDate: '',
               assigneeName: '',
               tags: [],
             });
           }} />
           <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
             <h2 className="text-xl font-bold font-mono mb-4">
               {editingTask ? 'Edit Task' : 'Create New Task'}
             </h2>
             <p className="text-gray-600 font-mono text-sm mb-6">
               {editingTask ? 'Update your task details' : 'Add a new task to your board'}
             </p>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                   Task Title *
                 </label>
                 <input
                   type="text"
                   value={taskForm.title}
                   onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                   placeholder="Enter task title..."
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                   Description
                 </label>
                 <textarea
                   value={taskForm.description}
                   onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                   placeholder="Describe your task..."
                   rows={3}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                     Priority
                   </label>
                   <select 
                     value={taskForm.priority}
                     onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value="low">Low</option>
                     <option value="medium">Medium</option>
                     <option value="high">High</option>
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                     Due Date
                   </label>
                   <input
                     type="date"
                     value={taskForm.dueDate}
                     onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                   Assignee Name
                 </label>
                 <input
                   type="text"
                   value={taskForm.assigneeName}
                   onChange={(e) => setTaskForm(prev => ({ ...prev, assigneeName: e.target.value }))}
                   placeholder="Who should do this task?"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                 />
               </div>
             </div>
             
             <div className="flex space-x-3 mt-6">
               <button
                 onClick={() => {
                   setShowCreateTask(false);
                   setEditingTask(null);
                   setTaskForm({
                     title: '',
                     description: '',
                     priority: 'medium',
                     dueDate: '',
                     assigneeName: '',
                     tags: [],
                   });
                 }}
                 disabled={isSubmitting}
                 className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
               >
                 Cancel
               </button>
               <button 
                 onClick={editingTask ? handleEditTask : handleCreateTask}
                 disabled={isSubmitting}
                 className="flex-1 px-4 py-2 bg-black text-white rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
               >
                 {isSubmitting ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
               </button>
                           </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowDeleteConfirm(false);
              setTaskToDelete(null);
            }} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono">Delete Task</h2>
                  <p className="text-gray-600 font-mono text-sm">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 font-mono">
                  Are you sure you want to delete <span className="font-bold">"{taskToDelete.title}"</span>?
                </p>
                <p className="text-sm text-gray-500 font-mono mt-2">
                  This task will be permanently removed from your board.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setTaskToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteTask(taskToDelete.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-mono font-bold text-sm hover:bg-red-700 transition-colors"
                >
                  Delete Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } 