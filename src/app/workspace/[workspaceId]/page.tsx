'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { workspaceService, boardService, taskService } from '@/lib/services';
import { Workspace, Board, Task } from '@/types';
import { 
  Plus, 
  Users, 
  Calendar,
  Grid3X3,
  List,
  Clock,
  Edit,
  Trash2,
  ArrowLeft,
  Target
} from 'lucide-react';
import EditWorkspaceModal from '../../../components/EditWorkspaceModal';

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newBoard, setNewBoard] = useState({
    name: '',
    description: '',
    color: 'bg-blue-500'
  });

  const colorOptions = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500',
    'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];

  useEffect(() => {
    if (!user || !workspaceId) return;

    const loadWorkspaceData = async () => {
      try {
        // Load workspace details
        const workspaceData = await workspaceService.getWorkspace(workspaceId);
        setWorkspace(workspaceData);

        // Load boards for this workspace
        const workspaceBoards = await boardService.getBoardsByWorkspace(workspaceId);
        setBoards(workspaceBoards);

        // Load tasks from all boards
        const allTasks: Task[] = [];
        for (const board of workspaceBoards) {
          try {
            const boardTasks = await taskService.getTasksByBoard(board.id);
            // Add board info to tasks for display
            const tasksWithBoardInfo = boardTasks.map(task => ({
              ...task,
              boardName: board.name,
              boardId: board.id
            }));
            allTasks.push(...tasksWithBoardInfo);
          } catch (error) {
            console.error(`Error loading tasks for board ${board.id}:`, error);
          }
        }
        
        // Sort tasks by updatedAt (newest first) to match dashboard order
        const sortedTasks = allTasks.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setTasks(sortedTasks);
      } catch (error) {
        console.error('Error loading workspace data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceData();
  }, [user, workspaceId]);

  const handleCreateBoard = async () => {
    if (!user || !workspace || !newBoard.name.trim()) return;

    try {
      const boardData = {
        name: newBoard.name.trim(),
        description: newBoard.description.trim(),
        workspaceId: workspace.id,
        color: newBoard.color,
        ownerId: user.uid,
        members: [user.uid],
        columns: [
          { id: 'todo', name: 'To Do', order: 0, tasks: [] },
          { id: 'inprogress', name: 'In Progress', order: 1, tasks: [] },
          { id: 'done', name: 'Done', order: 2, tasks: [] }
        ]
      };

      const boardId = await boardService.createBoard(boardData);
      
      // Refresh boards
      const updatedBoards = await boardService.getBoardsByWorkspace(workspaceId);
      setBoards(updatedBoards);

      // Reset form
      setNewBoard({ name: '', description: '', color: 'bg-blue-500' });
      setShowCreateBoard(false);

      // Navigate to the new board
      router.push(`/workspace/${workspaceId}/board/${boardId}`);
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  const handleBoardClick = (boardId: string) => {
    router.push(`/workspace/${workspaceId}/board/${boardId}`);
  };

  const handleEditWorkspace = async (data: { name: string; description: string; color: string }) => {
    if (!workspace) return;
    
    try {
      await workspaceService.updateWorkspace(workspace.id, data);
      setWorkspace(prev => prev ? { ...prev, ...data } : null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading workspace...</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-gray-800 mb-4">Workspace not found</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-200 via-pink-100 to-yellow-100 rounded-full blur-3xl opacity-60 animate-blob1 z-0" />
      <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-gradient-to-br from-pink-200 via-blue-100 to-yellow-100 rounded-full blur-2xl opacity-50 animate-blob2 z-0" />

      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-[60]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <button
                onClick={() => router.push('/dashboard')}
                className="group relative overflow-hidden flex items-center justify-center px-2 py-2 sm:px-3 sm:py-3 bg-white/80 hover:bg-black text-gray-800 hover:text-white rounded-xl sm:rounded-2xl transition-all duration-500 hover:scale-110 hover:shadow-2xl border border-gray-300 hover:border-black backdrop-blur-md hover:backdrop-blur-xl flex-shrink-0"
              >
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-black via-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl sm:rounded-2xl"></div>
                
                {/* Content */}
                <div className="relative z-10 flex items-center justify-center space-x-1 sm:space-x-2">
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:scale-110" />
                  <span className="font-mono font-bold text-xs sm:text-sm opacity-0 sm:group-hover:opacity-100 transition-all duration-300 delay-100 transform translate-x-2 group-hover:translate-x-0 hidden sm:inline">
                    Dashboard
                  </span>
                </div>
                
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </div>
              </button>
              
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${workspace.color} animate-pulse flex-shrink-0`}></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-mono font-bold text-gray-900 truncate">{workspace.name}</h1>
                  {workspace.description && (
                    <p className="text-xs sm:text-sm text-gray-600 font-mono truncate hidden sm:block">{workspace.description}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <button 
                onClick={() => setShowEditModal(true)}
                className="bg-black text-white px-2 py-2 sm:px-4 sm:py-2 rounded-lg font-mono font-bold text-xs sm:text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-1 sm:space-x-2"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Edit Workspace</span>
                <span className="sm:hidden">Edit</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-6 relative z-[50]">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          {(() => {
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(task => 
              task.status === 'completed' || task.columnId === 'done'
            ).length;
            const activeTasks = totalTasks - completedTasks;


            return (
              <>
                <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 font-mono text-sm">Total Boards</p>
                      <p className="text-3xl font-bold font-mono group-hover:text-gray-700 transition-colors duration-200">{boards.length}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="h-1 bg-gray-200 rounded-full flex-1">
                          <div 
                            className="h-1 bg-gray-500 rounded-full transition-all duration-300"
                            style={{ width: boards.length > 0 ? '100%' : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-500">Active</span>
                      </div>
                    </div>
                    <Grid3X3 className="w-8 h-8 text-gray-600 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>

                <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 font-mono text-sm">Total Tasks</p>
                      <p className="text-3xl font-bold font-mono text-blue-600 group-hover:text-blue-700 transition-colors duration-200">{totalTasks}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="h-1 bg-blue-100 rounded-full flex-1">
                          <div 
                            className="h-1 bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: totalTasks > 0 ? '100%' : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-blue-600">All</span>
                      </div>
                    </div>
                    <Target className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>

                <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 font-mono text-sm">Completed</p>
                      <p className="text-3xl font-bold font-mono text-green-600 group-hover:text-green-700 transition-colors duration-200">{completedTasks}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="h-1 bg-green-100 rounded-full flex-1">
                          <div 
                            className="h-1 bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-green-600">
                          {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <Calendar className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>

                <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.3s' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 font-mono text-sm">Active Tasks</p>
                      <p className="text-3xl font-bold font-mono text-orange-600 group-hover:text-orange-700 transition-colors duration-200">{activeTasks}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="h-1 bg-orange-100 rounded-full flex-1">
                          <div 
                            className="h-1 bg-orange-500 rounded-full transition-all duration-300"
                            style={{ width: totalTasks > 0 ? `${(activeTasks / totalTasks) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-orange-600">
                          {totalTasks > 0 ? Math.round((activeTasks / totalTasks) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>

                <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.4s' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 font-mono text-sm">Members</p>
                      <p className="text-3xl font-bold font-mono text-purple-600 group-hover:text-purple-700 transition-colors duration-200">{workspace.members.length}</p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="h-1 bg-purple-100 rounded-full flex-1">
                          <div 
                            className="h-1 bg-purple-500 rounded-full transition-all duration-300"
                            style={{ width: workspace.members.length > 0 ? '100%' : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-purple-600">Active</span>
                      </div>
                    </div>
                    <Users className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold font-mono">Your Boards</h2>
                <button
                  onClick={() => setShowCreateBoard(true)}
                  className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Board</span>
                </button>
              </div>

              {/* Create Board Form */}
              {showCreateBoard && (
                <div className="bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm p-8 rounded-2xl border-2 border-gray-200/60 shadow-xl mb-8 animate-fadein">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-xl text-gray-900">Create New Board</h3>
                      <p className="text-sm text-gray-600 font-mono">Set up a new board to organize your tasks</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                        Board Name
                      </label>
                      <input
                        type="text"
                        value={newBoard.name}
                        onChange={(e) => setNewBoard(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                        placeholder="Enter board name..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                        Color
                      </label>
                      <div className="flex space-x-2">
                        {colorOptions.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewBoard(prev => ({ ...prev, color }))}
                            className={`w-10 h-10 rounded-xl ${color} ${newBoard.color === color ? 'ring-4 ring-white shadow-lg scale-110' : 'hover:scale-110'} transition-all duration-200 shadow-md hover:shadow-lg`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-mono font-bold text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={newBoard.description}
                      onChange={(e) => setNewBoard(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm resize-none"
                      placeholder="Enter board description..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowCreateBoard(false)}
                      className="px-6 py-3 text-gray-600 hover:text-red-500 hover:bg-red-50 font-mono font-medium rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-red-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateBoard}
                      disabled={!newBoard.name.trim()}
                      className="px-6 py-3 bg-black text-white rounded-xl hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100 font-mono font-bold flex items-center space-x-2 shadow-lg hover:shadow-xl"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Board</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Boards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boards.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Plus className="w-10 h-10 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No boards yet</h3>
                    <p className="text-gray-500">Create your first board to get started!</p>
                  </div>
                ) : (
                  boards.map((board, index) => (
                    <div
                      key={board.id}
                      className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer animate-fadein border border-gray-100 hover:border-gray-200 hover:-translate-y-2 overflow-hidden"
                      style={{ animationDelay: `${0.1 * index}s` }}
                      onClick={() => handleBoardClick(board.id)}
                    >
                      {/* Background Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      
                      {/* Content */}
                      <div className="relative z-10">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${board.color || 'bg-blue-500'} shadow-lg group-hover:scale-125 group-hover:shadow-xl transition-all duration-300`}></div>
                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-gray-900 transition-colors duration-200 line-clamp-1">{board.name}</h3>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        
                        {/* Description */}
                        {board.description ? (
                          <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                            {board.description}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-sm italic mb-6">No description</p>
                        )}
                        
                        {/* Stats */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 text-gray-500 group-hover:text-gray-600 transition-colors duration-200">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                                <List className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="text-sm font-medium">{tasks.filter(t => t.boardId === board.id).length}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-500 group-hover:text-gray-600 transition-colors duration-200">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-200">
                                <Clock className="w-4 h-4 text-purple-600" />
                              </div>
                              <span className="text-sm font-medium">{new Date(board.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          
                          {/* Arrow Icon */}
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:scale-110 transition-all duration-300">
                            <svg className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover Shine Effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute top-0 -left-4 w-6 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Recent Tasks */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 animate-fadein" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-black to-black rounded-xl flex items-center justify-center shadow-lg">
                    <List className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Recent Tasks</h2>
                </div>
              </div>
              
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <List className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 text-sm">Tasks will appear here as you create them</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tasks.slice(0, 8).map((task) => {
                    const isCompleted = task.status === 'completed' || task.columnId === 'done';
                    
                    return (
                      <div
                        key={task.id}
                        className="group relative bg-gradient-to-r from-white to-gray-50/50 border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                        onClick={() => {
                          if (task.boardId) {
                            router.push(`/workspace/${workspaceId}/board/${task.boardId}`);
                          }
                        }}
                      >
                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-gray-900 transition-colors duration-200 pr-2">
                              {task.title}
                            </h4>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                </div>
                                <span className="text-xs font-medium text-gray-600">
                                  {task.boardName || 'Unknown'}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                  isCompleted ? 'bg-green-100' :
                                  task.columnId === 'inprogress' ? 'bg-yellow-100' :
                                  'bg-gray-100'
                                }`}>
                                  <div className={`w-2 h-2 rounded-full ${
                                    isCompleted ? 'bg-green-500' :
                                    task.columnId === 'inprogress' ? 'bg-yellow-500' :
                                    'bg-gray-500'
                                  }`}></div>
                                </div>
                                <span className={`text-xs font-medium ${
                                  isCompleted ? 'text-green-600' :
                                  task.columnId === 'inprogress' ? 'text-yellow-600' :
                                  'text-gray-600'
                                }`}>
                                  {task.columnId === 'inprogress' ? 'progress' : task.columnId}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Hover Shine Effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute top-0 -left-4 w-6 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Workspace Modal */}
      <EditWorkspaceModal
        isOpen={showEditModal}
        onCloseAction={() => setShowEditModal(false)}
        workspace={workspace}
        onSubmitAction={handleEditWorkspace}
      />

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.98); 
          } 
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          } 
        }
        .animate-fadein { 
          animation: fadein 0.8s cubic-bezier(0.4, 0, 0.2, 1); 
        }
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
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}