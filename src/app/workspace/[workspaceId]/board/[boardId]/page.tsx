'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { workspaceService, boardService, taskService } from '@/lib/services';
import { Workspace, Board, Task, Column } from '@/types';
import { ArrowLeft, Plus, Users, Settings, MoreHorizontal } from 'lucide-react';

export default function BoardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const boardId = params.boardId as string;
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
      return;
    }

    if (user && workspaceId && boardId) {
      loadBoardData();
    }
  }, [user, loading, workspaceId, boardId]);

  const loadBoardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load workspace and board details
      const [workspaceData, boardData, tasksData] = await Promise.all([
        workspaceService.getWorkspace(workspaceId),
        boardService.getBoard(boardId),
        taskService.getTasks(boardId)
      ]);

      setWorkspace(workspaceData);
      setBoard(boardData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading board:', error);
      setError('Failed to load board. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = (columnId: string) => {
    // TODO: Implement task creation
    console.log('Add task to column:', columnId);
  };

  const getTasksForColumn = (columnId: string) => {
    return tasks.filter(task => task.columnId === columnId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'todo': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-mono mb-4">{error}</div>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="bg-black text-white px-4 py-2 rounded-lg font-mono"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/workspace/${workspaceId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold font-mono">
                  {board?.name || 'Board'}
                </h1>
                <p className="text-gray-600 text-sm font-mono">
                  {workspace?.name} • {board?.description || 'No description'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Users className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {board?.columns && board.columns.length > 0 ? (
          <div className="flex space-x-6 overflow-x-auto pb-6">
            {board.columns.map((column) => (
              <div key={column.id} className="flex-shrink-0 w-80">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold font-mono">{column.name}</h3>
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-mono">
                        {getTasksForColumn(column.id).length}
                      </span>
                    </div>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-3 mb-4">
                    {getTasksForColumn(column.id).map((task) => (
                      <div
                        key={task.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer"
                      >
                        <h4 className="font-mono font-bold text-sm mb-2">{task.title}</h4>
                        {task.description && (
                          <p className="text-gray-600 text-xs font-mono mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-mono ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            {task.priority && (
                              <span className={`text-xs font-mono font-bold ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                            )}
                          </div>
                          
                          {task.dueDate && (
                            <span className="text-xs text-gray-500 font-mono">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Task Button */}
                  <button
                    onClick={() => handleAddTask(column.id)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-lg font-mono text-sm transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold font-mono mb-2">No columns yet</h3>
            <p className="text-gray-600 font-mono mb-4">This board doesn't have any columns set up</p>
            <button className="bg-black text-white px-6 py-3 rounded-lg font-mono font-bold hover:bg-gray-800 transition-colors">
              Add Column
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
