'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Plus, Search, Bell, Settings, Users, Calendar, BarChart3, Zap, Palette, Shield, Smartphone, ArrowUpDown, PartyPopper, CheckSquare, ListTodo, Star, Clock, Tag, Filter } from 'lucide-react';
import { workspaceService, statsService, boardService } from '@/lib/services';
import { Workspace, QuickStats, Board } from '@/types';
import CreateModal from '@/components/CreateModal';
import CreateBoardModal from '@/components/CreateBoardModal';
import NotificationDrawer from '@/components/NotificationDrawer';

export default function DashboardPage() {
  const { user, loading, logout, isFirebaseConfigured } = useAuth();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [modalType, setModalType] = useState<'workspace' | 'board'>('workspace');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceBoards, setWorkspaceBoards] = useState<{ [workspaceId: string]: Board[] }>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    productivityScore: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Load user data
  useEffect(() => {
    if (user && isFirebaseConfigured) {
      const loadUserData = async () => {
        try {
          setIsLoading(true);
          
          // Load workspaces
          const userWorkspaces = await workspaceService.getWorkspaces(user.uid);
          setWorkspaces(userWorkspaces);
          
          // Load boards for each workspace
          const boardsData: { [workspaceId: string]: Board[] } = {};
          for (const workspace of userWorkspaces) {
            try {
              const boards = await boardService.getBoards(workspace.id);
              boardsData[workspace.id] = boards;
            } catch (error) {
              console.error(`Error loading boards for workspace ${workspace.id}:`, error);
              boardsData[workspace.id] = [];
            }
          }
          setWorkspaceBoards(boardsData);
          
          // Load quick stats
          const stats = await statsService.getQuickStats(user.uid);
          setQuickStats(stats);
          
          // Load notifications (mock for now)
          setNotifications([
            {
              id: '1',
              title: 'Board Created',
              message: 'Your new board "Project Tasks" has been created successfully!',
              type: 'success',
              read: false,
              createdAt: new Date(Date.now() - 1000 * 60 * 5),
            },
            {
              id: '2',
              title: 'Task Assigned',
              message: 'You have been assigned a new task in "Design Board"',
              type: 'info',
              read: true,
              createdAt: new Date(Date.now() - 1000 * 60 * 30),
            },
            {
              id: '3',
              title: 'Workspace Updated',
              message: 'New member joined your "Personal Tasks" workspace',
              type: 'info',
              read: false,
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
            },
          ]);
        } catch (error) {
          console.error('Error loading user data:', error);
          // Set default values on error
          setWorkspaces([]);
          setWorkspaceBoards({});
          setQuickStats({
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            productivityScore: 0,
          });
          setNotifications([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadUserData();
    }
  }, [user, isFirebaseConfigured]);

  // Memoize user initials to prevent recalculation
  const userInitials = useMemo(() => {
    return user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
  }, [user?.displayName]);

  // Memoize account creation date
  const accountCreatedDate = useMemo(() => {
    return user?.metadata.creationTime 
      ? new Date(user.metadata.creationTime).toLocaleDateString() 
      : 'Unknown';
  }, [user?.metadata.creationTime]);

  // Get unread notifications count
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Optimize logout function
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Optimize navigation function
  const handleGoToSetup = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleCreateWorkspace = useCallback(() => {
    setModalType('workspace');
    setShowCreateModal(true);
  }, []);

  const handleCreateBoard = useCallback(() => {
    if (workspaces.length > 0) {
      setShowCreateBoardModal(true);
    } else {
      // If no workspaces, show the create workspace modal first
      setModalType('workspace');
      setShowCreateModal(true);
    }
  }, [workspaces]);

  const handleCreateBoardSubmit = useCallback(async (data: { name: string; description: string; workspaceId: string }) => {
    if (!user) return;

    try {
      // Create board with default columns
      const defaultColumns = [
        { id: 'todo', name: 'To Do', order: 1, tasks: [] },
        { id: 'in-progress', name: 'In Progress', order: 2, tasks: [] },
        { id: 'completed', name: 'Completed', order: 3, tasks: [] },
      ];

      const boardId = await boardService.createBoard({
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        columns: defaultColumns,
      });

      // Refresh workspace boards
      const boards = await boardService.getBoards(data.workspaceId);
      setWorkspaceBoards(prev => ({
        ...prev,
        [data.workspaceId]: boards
      }));

      // Add notification
      setNotifications(prev => [
        {
          id: Date.now().toString(),
          title: 'Board Created',
          message: `Board "${data.name}" has been created successfully!`,
          type: 'success',
          read: false,
          createdAt: new Date(),
        },
        ...prev
      ]);

      console.log('Board created successfully:', boardId);
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Error creating board. Please check your Firebase configuration.');
    }
  }, [user]);

  const handleInviteTeam = useCallback(() => {
    // TODO: Implement team invitation
    console.log('Invite team clicked');
  }, []);

  const handleCreateSubmit = useCallback(async (data: any) => {
    if (!user) return;

    try {
      if (modalType === 'workspace') {
        const workspaceId = await workspaceService.createWorkspace({
          ...data,
          ownerId: user.uid,
          members: [user.uid],
        });
        
        // Refresh workspaces after creation
        const userWorkspaces = await workspaceService.getWorkspaces(user.uid);
        setWorkspaces(userWorkspaces);
        
        console.log('Workspace created successfully:', workspaceId);
      } else if (modalType === 'board') {
        // TODO: Implement board creation
        console.log('Create board:', data);
      }
    } catch (error) {
      console.error('Error creating', modalType, error);
      alert('Error creating ' + modalType + '. Please check your Firebase configuration.');
    }
  }, [modalType, user]);

  const handleWorkspaceClick = useCallback((workspaceId: string) => {
    router.push(`/workspace/${workspaceId}/board/new`);
  }, [router]);

  const handleBoardClick = useCallback((workspaceId: string, boardId: string) => {
    router.push(`/workspace/${workspaceId}/board/${boardId}`);
  }, [router]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to home
  }


  const UserAvatar = () => {
    if (!user.photoURL || imageError) {
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

  const UserProfileImage = () => {
    if (!user.photoURL || imageError) {
      return (
        <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-2xl">{userInitials}</span>
        </div>
      );
    }

    return (
      <Image
        src={user.photoURL}
        alt={user.displayName || 'User'}
        width={80}
        height={80}
        className="rounded-full"
        onError={() => setImageError(true)}
        priority
      />
    );
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

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-200 via-pink-100 to-yellow-100 rounded-full blur-3xl opacity-60 animate-blob1 z-0" />
      <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-gradient-to-br from-pink-200 via-blue-100 to-yellow-100 rounded-full blur-2xl opacity-50 animate-blob2 z-0" />
      
      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(86)].map((_, i) => (
          <div
            key={i}
            className="w-full h-0.5 border-t border-dashed border-gray-200 opacity-60 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
            style={{ position: 'absolute', top: `${i * 2.2}rem` }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <img src="/tasky_logo.svg" alt="Tasky Logo" className="w-10 h-10 transition-transform duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-2xl font-extrabold font-mono tracking-tight">Tasky</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks, workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 backdrop-blur-sm"
                />
              </div>

              {/* Notifications */}
              <button 
                className="relative p-2 text-gray-600 hover:text-black transition-colors"
                onClick={() => setShowNotificationDrawer(true)}
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Welcome Section */}
        <div className="text-center mb-12 animate-fadein">
          <h1 className="text-5xl font-extrabold font-mono mb-4">
            Welcome back, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user.displayName}</span>!
          </h1>
          <p className="text-xl text-gray-600 font-mono">Ready to organize your tasks and boost productivity?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Total Tasks</p>
                <p className="text-3xl font-bold font-mono">{quickStats.totalTasks}</p>
              </div>
              <CheckSquare className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-600 font-mono text-sm">Completed</p>
                <p className="text-3xl font-bold font-mono text-green-600">{quickStats.completedTasks}</p>
              </div>
              <PartyPopper className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Pending</p>
                <p className="text-3xl font-bold font-mono text-orange-600">{quickStats.pendingTasks}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Productivity</p>
                <p className="text-3xl font-bold font-mono text-purple-600">{quickStats.productivityScore}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Workspaces & Quick Actions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Workspaces */}
            <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold font-mono">Your Workspaces</h2>
                <button
                  onClick={handleCreateWorkspace}
                  className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Workspace</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {workspaces.map((workspace, index) => {
                   const workspaceBoardsList = workspaceBoards[workspace.id] || [];
                   return (
                     <div 
                       key={workspace.id} 
                       className={`border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer animate-fadein ${workspace.color}`}
                       style={{ animationDelay: `${0.1 * index}s` }}
                       onClick={() => handleWorkspaceClick(workspace.id)}
                     >
                       <div className="flex items-center space-x-3 mb-3">
                         <div className="w-4 h-4 rounded-full bg-white/20"></div>
                         <h3 className="font-mono font-bold text-lg text-white">{workspace.name}</h3>
                       </div>
                       <div className="flex justify-between text-sm text-white/80 font-mono mb-3">
                         <span>{workspace.description || 'No description'}</span>
                         <span>{workspace.members.length} members</span>
                       </div>
                       
                       {/* Boards in this workspace */}
                       {workspaceBoardsList.length > 0 && (
                         <div className="space-y-2">
                           <p className="text-xs text-white/70 font-mono font-bold">Boards:</p>
                           <div className="space-y-1">
                             {workspaceBoardsList.slice(0, 3).map((board) => (
                               <div
                                 key={board.id}
                                 className="flex items-center space-x-2 p-2 bg-white/10 rounded text-xs text-white/90 font-mono hover:bg-white/20 transition-colors"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleBoardClick(workspace.id, board.id);
                                 }}
                               >
                                 <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                                 <span className="truncate">{board.name}</span>
                               </div>
                             ))}
                             {workspaceBoardsList.length > 3 && (
                               <div className="text-xs text-white/60 font-mono">
                                 +{workspaceBoardsList.length - 3} more boards
                               </div>
                             )}
                           </div>
                         </div>
                       )}
                       
                       {workspaceBoardsList.length === 0 && (
                         <div className="text-xs text-white/60 font-mono">
                           No boards yet
                         </div>
                       )}
                     </div>
                   );
                 })}
                 {workspaces.length === 0 && (
                   <div className="col-span-2 text-center py-8 text-gray-500 font-mono">
                     <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Plus className="w-8 h-8 text-gray-400" />
                     </div>
                     <p className="text-lg font-bold mb-2">No workspaces yet</p>
                     <p className="text-sm">Create your first workspace to get started!</p>
                   </div>
                 )}
               </div>
            </div>
            
            {/* Recent Tasks - Coming Soon */}
            <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold font-mono">Recent Tasks</h2>
                <span className="text-sm text-gray-500 font-mono">Coming Soon</span>
              </div>
              
              <div className="text-center py-8 text-gray-500 font-mono">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ListTodo className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg font-bold mb-2">Tasks coming soon!</p>
                <p className="text-sm">Create boards to start managing your tasks</p>
              </div>
            </div>
          </div>

          {/* Right Column - User Profile & Quick Actions */}
          <div className="space-y-8">
            {/* User Profile Card */}
            <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center space-x-4 mb-6">
                <UserProfileImage />
                <div>
                  <h2 className="text-xl font-bold font-mono mb-1">{user.displayName}</h2>
                  <p className="text-gray-600 font-mono text-sm">{user.email}</p>
                </div>
            </div>
            
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-600">Email Verified</span>
                  <span className={`font-semibold ${user.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
                    {user.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Member Since</span>
                  <span className="font-semibold">{accountCreatedDate}</span>
                </div>
                  <div className="flex justify-end">
                  <button
                    onClick={handleLogout}
                      className="bg-black text-white px-3 py-1 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-colors"
                  >
                  Sign Out
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.5s' }}>
              <h3 className="text-xl font-bold font-mono mb-6">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleCreateBoard}
                  className="w-full bg-black text-white p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Board</span>
                </button>
                
                <button
                  onClick={handleInviteTeam}
                  className="w-full bg-white text-black border-2 border-black p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Invite Team</span>
                </button>
                
                <button className="w-full bg-white text-black border-2 border-gray-300 p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
          </div>
        </div>

            {/* Features Coming Soon */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.6s' }}>
              <h3 className="text-xl font-bold font-mono mb-4 text-blue-900">🚀 Coming Soon!</h3>
              <div className="space-y-3 text-sm font-mono">
                <div className="flex items-center space-x-2">
                  <ArrowUpDown className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-800">Drag & Drop Kanban Boards</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-800">Real-time Team Collaboration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-green-600" />
                  <span className="text-green-800">Smart Notifications</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                  <span className="text-orange-800">Advanced Analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        type={modalType}
        onSubmit={handleCreateSubmit}
      />

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={showCreateBoardModal}
        onClose={() => setShowCreateBoardModal(false)}
        onSubmit={handleCreateBoardSubmit}
        workspaces={workspaces}
      />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        userId={user.uid}
      />

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadein { animation: fadein 0.8s ease-out; }
        @keyframes blob1 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.1) translateY(20px);} }
        .animate-blob1 { animation: blob1 8s ease-in-out infinite; }
        @keyframes blob2 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.05) translateY(-20px);} }
        .animate-blob2 { animation: blob2 10s ease-in-out infinite; }
        @keyframes spiral { 0% { box-shadow: 0 0 0 0 #bbb; } 50% { box-shadow: 0 0 8px 2px #bbb; } 100% { box-shadow: 0 0 0 0 #bbb; } }
        .animate-spiral { animation: spiral 2.5s infinite; }
      `}</style>
    </div>
  );
}