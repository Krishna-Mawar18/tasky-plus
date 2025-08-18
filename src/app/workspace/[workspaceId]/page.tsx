'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, use } from 'react';
import { Plus, ArrowLeft, Edit, Users, Calendar, BarChart3, CheckSquare, Clock, Target, Settings, Trash2, MoreVertical } from 'lucide-react';
import { workspaceService, boardService, taskService } from '@/lib/services';
import { Workspace, Board, Task } from '@/types';
import CreateBoardModal from '@/components/CreateBoardModal';
import EditWorkspaceModal from '@/components/EditWorkspaceModal';

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const resolvedParams = use(params);
  const { user, loading, isFirebaseConfigured } = useAuth();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showEditWorkspaceModal, setShowEditWorkspaceModal] = useState(false);
  const [workspaceStats, setWorkspaceStats] = useState({
    totalBoards: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    productivityScore: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load workspace data
  const loadWorkspaceData = useCallback(async () => {
    if (!user || !isFirebaseConfigured || !resolvedParams.workspaceId) return;

    try {
      setIsLoading(true);
      
      // Load workspace details
      const workspaceData = await workspaceService.getWorkspace(resolvedParams.workspaceId);
      setWorkspace(workspaceData);
      
      // Load boards
      const boardsData = await boardService.getBoards(resolvedParams.workspaceId);
      setBoards(boardsData);
      
      // Load all tasks from all boards
      const tasksPromises = boardsData.map(board => taskService.getTasks(board.id));
      const tasksArrays = await Promise.all(tasksPromises);
      const allTasksFlat = tasksArrays.flat();
      setAllTasks(allTasksFlat);
      
      // Calculate stats
      const completedColumnIds = ['completed', 'done', 'resolved'];
      const completedTasks = allTasksFlat.filter(task => 
        task.status === 'completed' || completedColumnIds.includes(task.columnId.toLowerCase())
      ).length;
      const pendingTasks = allTasksFlat.filter(task => 
        task.status !== 'completed' && !completedColumnIds.includes(task.columnId.toLowerCase())
      ).length;
      const productivityScore = allTasksFlat.length > 0 ? Math.round((completedTasks / allTasksFlat.length) * 100) : 0;
      
      setWorkspaceStats({
        totalBoards: boardsData.length,
        totalTasks: allTasksFlat.length,
        completedTasks,
        pendingTasks,
        productivityScore,
      });
      
    } catch (error) {
      console.error('Error loading workspace data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isFirebaseConfigured, resolvedParams.workspaceId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Handle create board
  const handleCreateBoard = useCallback(async (boardData: any) => {
    await loadWorkspaceData(); // Refresh data after creating board
  }, [loadWorkspaceData]);

  // Handle edit workspace
  const handleEditWorkspace = useCallback(async (updatedData: any) => {
    if (workspace) {
      setWorkspace({ ...workspace, ...updatedData });
    }
  }, [workspace]);

  // Get task status color
  const getTaskStatusColor = (task: Task) => {
    const completedColumnIds = ['completed', 'done', 'resolved'];
    if (task.status === 'completed' || completedColumnIds.includes(task.columnId.toLowerCase())) {
      return 'bg-green-100 text-green-800';
    } else if (task.columnId === 'in-progress') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-mono text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-gray-600 mb-4">Workspace not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-bold font-mono">{workspace.name}</h1>
                <p className="text-sm text-gray-600 font-mono">{workspace.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowEditWorkspaceModal(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 hover:scale-105 transition-all duration-200 flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Workspace</span>
              </button>
              <button
                onClick={() => setShowCreateBoardModal(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 hover:scale-105 transition-all duration-200 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Board</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workspace Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-sm">Total Boards</p>
                <p className="text-3xl font-bold font-mono group-hover:text-gray-700 transition-colors duration-200">{workspaceStats.totalBoards}</p>
              </div>
              <Target className="w-8 h-8 text-gray-600 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-sm">Total Tasks</p>
                <p className="text-3xl font-bold font-mono group-hover:text-gray-700 transition-colors duration-200">{workspaceStats.totalTasks}</p>
              </div>
              <CheckSquare className="w-8 h-8 text-gray-600 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-sm">Completed</p>
                <p className="text-3xl font-bold font-mono text-green-600 group-hover:text-green-700 transition-colors duration-200">{workspaceStats.completedTasks}</p>
              </div>
              <CheckSquare className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-sm">Pending</p>
                <p className="text-3xl font-bold font-mono text-orange-600 group-hover:text-orange-700 transition-colors duration-200">{workspaceStats.pendingTasks}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-sm">Productivity</p>
                <p className="text-3xl font-bold font-mono text-purple-600 group-hover:text-purple-700 transition-colors duration-200">{workspaceStats.productivityScore}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
        </div>

        {/* Boards Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold font-mono mb-6">Boards</h2>
          {boards.length === 0 ? (
            <div className="bg-white/90 border border-gray-200 rounded-xl p-8 shadow-lg text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-mono font-bold text-gray-900 mb-2">No boards yet</h3>
              <p className="text-gray-600 font-mono mb-4">Create your first board to get started</p>
              <button
                onClick={() => setShowCreateBoardModal(true)}
                className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                Create Board
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board, index) => {
                const boardTasks = allTasks.filter(task => task.boardId === board.id);
                const completedColumnIds = ['completed', 'done', 'resolved'];
                const completedTasks = boardTasks.filter(task => 
                  task.status === 'completed' || completedColumnIds.includes(task.columnId.toLowerCase())
                ).length;
                
                return (
                  <div
                    key={board.id}
                    className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105 cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => router.push(`/workspace/${resolvedParams.workspaceId}/board/${board.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-mono font-bold text-gray-900 mb-2 group-hover:text-black transition-colors">
                          {board.name}
                        </h3>
                        {board.description && (
                          <p className="text-sm text-gray-600 font-mono mb-3">{board.description}</p>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Add board options menu here if needed
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600">Tasks</span>
                        <span className="font-bold text-gray-900">{boardTasks.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600">Completed</span>
                        <span className="font-bold text-green-600">{completedTasks}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-bold text-purple-600">
                          {boardTasks.length > 0 ? Math.round((completedTasks / boardTasks.length) * 100) : 0}%
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${boardTasks.length > 0 ? (completedTasks / boardTasks.length) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Tasks */}
        <div>
          <h2 className="text-2xl font-bold font-mono mb-6">Recent Tasks</h2>
          {allTasks.length === 0 ? (
            <div className="bg-white/90 border border-gray-200 rounded-xl p-8 shadow-lg text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-mono font-bold text-gray-900 mb-2">No tasks yet</h3>
              <p className="text-gray-600 font-mono">Tasks will appear here once you create boards and add tasks</p>
            </div>
          ) : (
            <div className="bg-white/90 border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {allTasks.slice(0, 10).map((task, index) => {
                  const board = boards.find(b => b.id === task.boardId);
                  return (
                    <div
                      key={task.id}
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => router.push(`/workspace/${resolvedParams.workspaceId}/board/${task.boardId}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-mono font-bold text-gray-900 mb-1">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 font-mono mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center space-x-3">
                            <span className="text-xs text-gray-500 font-mono">
                              {board?.name || 'Unknown Board'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-mono font-bold ${getTaskStatusColor(task)}`}>
                              {task.columnId.replace('-', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-mono font-bold ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : 'Recently'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {allTasks.length > 10 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600 font-mono">
                    Showing 10 of {allTasks.length} tasks
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateBoardModal && (
        <CreateBoardModal
          isOpen={showCreateBoardModal}
          onClose={() => setShowCreateBoardModal(false)}
          onSubmit={handleCreateBoard}
          workspaces={workspace ? [workspace] : []}
        />
      )}

      {showEditWorkspaceModal && workspace && (
        <EditWorkspaceModal
          isOpen={showEditWorkspaceModal}
          onClose={() => setShowEditWorkspaceModal(false)}
          onSubmit={handleEditWorkspace}
          workspace={workspace}
        />
      )}

      {/* CSS Animations */}
      <style jsx>{`
        .animate-fadein { 
          animation: fadein 0.6s ease-out forwards; 
          opacity: 0;
        }
        @keyframes fadein { 
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          } 
          to { 
            opacity: 1; 
            transform: translateY(0); 
          } 
        }
      `}</style>
    </div>
  );
}
