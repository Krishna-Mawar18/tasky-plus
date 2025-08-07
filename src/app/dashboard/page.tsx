'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Plus, Search, Bell, Settings, Users, Calendar, BarChart3, Zap, Palette, Shield, Smartphone, ArrowUpDown, PartyPopper, CheckSquare, ListTodo, Star, Clock, Tag, Filter, Edit, Trash2, X, FileText } from 'lucide-react';
import { workspaceService, statsService, searchService, boardService, notificationService, userService } from '@/lib/services';
import { Workspace, QuickStats, Board, Task } from '@/types';
import CreateModal from '@/components/CreateModal';
import CreateBoardModal from '@/components/CreateBoardModal';
import EditWorkspaceModal from '@/components/EditWorkspaceModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import NotificationPopup from '@/components/NotificationPopup';
import SearchResults from '@/components/SearchResults';
import FirebaseSetupGuide from '@/components/FirebaseSetupGuide';

export default function DashboardPage() {
  const { user, loading, logout, isFirebaseConfigured } = useAuth();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ workspaces: Workspace[]; }>({ workspaces: [] });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0); // Start with 0, will be updated dynamically
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceBoards, setWorkspaceBoards] = useState<Record<string, Board[]>>({});
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    productivityScore: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // 1. Use real-time updates for workspaces
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;
    // Unsubscribe from previous listener if any
    if (unsubscribeRef.current) unsubscribeRef.current();
    setIsLoading(true);
    unsubscribeRef.current = workspaceService.subscribeToWorkspaces(user.uid, (liveWorkspaces) => {
      (async () => {
        setWorkspaces(liveWorkspaces);
        // Fetch boards for each workspace
        const boardsData: Record<string, Board[]> = {};
        for (const workspace of liveWorkspaces) {
          try {
            const boards = await boardService.getBoards(workspace.id);
            boardsData[workspace.id] = boards;
          } catch (error) {
            boardsData[workspace.id] = [];
          }
        }
        setWorkspaceBoards(boardsData);
        setIsLoading(false);
      })();
    });
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
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

  // Optimize logout function
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Optimize navigation function
  const handleGoToSetup = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleCreateWorkspace = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCreateBoard = useCallback(() => {
    if (workspaces.length === 0) {
      // If no workspaces, show the create workspace modal first
      setShowCreateModal(true);
      // You could also show a toast or alert here
      console.log('Please create a workspace first before creating a board');
    } else {
      setShowCreateBoardModal(true);
    }
  }, [workspaces]);

  const handleInviteTeam = useCallback(() => {
    // TODO: Implement team invitation
    console.log('Invite team clicked');
  }, []);

  // Search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (!user || !query.trim()) {
      setSearchResults({ workspaces: [] });
      setShowSearchResults(false);
      return;
    }

    try {
      const results = await searchService.searchAll(user.uid, query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults({ workspaces: [] });
      setShowSearchResults(false);
    }
  }, [user]);

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  }, [handleSearch]);

  const handleSearchNavigate = useCallback((type: 'workspace', id: string) => {
    if (type === 'workspace') {
      router.push(`/workspace/${id}`);
    }
  }, [router]);

  const handleCloseSearch = useCallback(() => {
    setShowSearchResults(false);
    setSearchQuery('');
  }, []);

  // Board creation handler
  const handleCreateBoardSubmit = useCallback(async (data: { name: string; description: string; workspaceId: string; columns?: any[] }) => {
    if (!user) return;

    try {
      const boardId = await boardService.createBoard({
        ...data,
        columns: data.columns || [],
      });
      
      console.log('Board created successfully:', boardId);
      setShowCreateBoardModal(false);
      
      // Navigate to the new board
      router.push(`/workspace/${data.workspaceId}/board/${boardId}`);
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Error creating board. Please check your Firebase configuration.');
    }
  }, [user, router]);

  // 2. Add error boundaries and user-friendly error messages for all async actions
  const handleCreateSubmit = useCallback(async (data: any) => {
    if (!user) return;
    setError(null);
    try {
      const workspaceId = await workspaceService.createWorkspace({
        ...data,
        ownerId: user.uid,
        members: [user.uid],
      });
      await userService.addWorkspaceToUser(user.uid, workspaceId);
      setShowCreateModal(false);
    } catch (err) {
      setError('Error creating workspace. Please check your Firebase configuration.');
    }
  }, [user]);

  // Edit workspace handler
  const handleEditWorkspace = useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setShowEditModal(true);
  }, []);

  const handleEditSubmit = useCallback(async (data: { name: string; description: string; color: string }) => {
    if (!user || !selectedWorkspace) return;
    setError(null);
    try {
      await workspaceService.updateWorkspace(selectedWorkspace.id, data);
    } catch (err) {
      setError('Error updating workspace. Please try again.');
    }
  }, [user, selectedWorkspace]);

  // Delete workspace handler
  const handleDeleteWorkspace = useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!user || !selectedWorkspace) return;
    setError(null);
    setIsDeleting(true);
    try {
      await workspaceService.deleteWorkspace(selectedWorkspace.id);
      setShowDeleteModal(false);
      setSelectedWorkspace(null);
    } catch (err) {
      setError('Error deleting workspace. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [user, selectedWorkspace]);

  // Create sample notifications
  const createSampleNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Check if user already has notifications
      const existingNotifications = await notificationService.getNotifications(user.uid);
      if (existingNotifications.length > 0) {
        // User already has notifications, don't create duplicates
        return;
      }

      const sampleNotifications = [
        {
          userId: user.uid,
          title: 'Welcome to SPARK!',
          message: 'Your account has been successfully created. Start by creating your first workspace.',
          type: 'success' as const,
          read: false,
        },
        {
          userId: user.uid,
          title: 'New Feature Available',
          message: 'Real-time collaboration is now available. Invite your team members to get started.',
          type: 'info' as const,
          read: false,
        },
        {
          userId: user.uid,
          title: 'Task Reminder',
          message: 'You have 3 pending tasks that need your attention.',
          type: 'warning' as const,
          read: false,
        },
      ];

      for (const notification of sampleNotifications) {
        await notificationService.createNotification(notification);
      }

      // Update notification count after creating sample notifications
      setNotificationCount(sampleNotifications.length);

      console.log('Sample notifications created');
    } catch (error) {
      console.error('Error creating sample notifications:', error);
    }
  }, [user]);

  // Load sample notifications on first visit
  useEffect(() => {
    if (user && isFirebaseConfigured) {
      createSampleNotifications();
    }
  }, [user, isFirebaseConfigured, createSampleNotifications]);

  // Function to update notification count
  const updateNotificationCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const notifications = await notificationService.getNotifications(user.uid);
      const unreadCount = notifications.filter((n: any) => !n.read).length;
      setNotificationCount(unreadCount);
    } catch (error) {
      console.error('Error updating notification count:', error);
    }
  }, [user]);

  // Test function to create a sample workspace (for debugging)
  const createSampleWorkspace = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Creating sample workspace for testing...');
      const workspaceId = await workspaceService.createWorkspace({
        name: 'Sample Workspace',
        description: 'This is a sample workspace for testing',
        color: 'bg-blue-500',
        ownerId: user.uid,
        members: [user.uid],
      });
      
      console.log('Sample workspace created:', workspaceId);
      
      // Also add workspace to user's workspace list
      await userService.addWorkspaceToUser(user.uid, workspaceId);
      console.log('Sample workspace added to user profile');
      
      // Refresh workspaces
      const userWorkspaces = await workspaceService.getWorkspaces(user.uid);
      setWorkspaces(userWorkspaces);
    } catch (error) {
      console.error('Error creating sample workspace:', error);
    }
  }, [user]);

  // Function to ensure user profile exists
  const ensureUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const userData = await userService.getUser(user.uid);
      if (!userData) {
        console.log('User profile does not exist, creating one...');
        // The AuthContext should handle this, but let's double-check
        console.log('User profile should be created by AuthContext');
      } else {
        console.log('User profile exists:', userData);
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
    }
  }, [user]);

  // Ensure user profile exists when component mounts
  useEffect(() => {
    if (user && isFirebaseConfigured) {
      ensureUserProfile();
    }
  }, [user, isFirebaseConfigured, ensureUserProfile]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <div className="text-black text-xl font-mono animate-pulse">Loading SPARK...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to home
  }

  if (!isFirebaseConfigured) {
    console.error('Firebase is not configured properly');
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-mono mb-4">Firebase Configuration Error</div>
          <div className="text-gray-600 font-mono">Please check your Firebase configuration</div>
        </div>
      </div>
    );
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
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-[60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <img src="/tasky_logo.svg" alt="Tasky Logo" className="w-10 h-10 transition-transform duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-2xl font-extrabold font-mono tracking-tight">SPARK</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <div className="relative z-[80]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onFocus={() => {
                    if (searchQuery.trim()) {
                      setShowSearchResults(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow clicking on results
                    setTimeout(() => setShowSearchResults(false), 200);
                  }}
                  className="pl-10 pr-4 py-2.5 w-64 md:w-80 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/90 backdrop-blur-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchResults(false);
                      setSearchResults({ workspaces: [] });
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {showSearchResults && (
                  <div className="relative z-[100]">
                    <SearchResults
                      results={searchResults}
                      query={searchQuery}
                      onClose={handleCloseSearch}
                      onNavigate={handleSearchNavigate}
                    />
                  </div>
                )}
              </div>

              {/* Notifications */}
              <button 
                onClick={() => setShowNotificationDrawer(true)}
                className="relative p-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-all duration-200 z-[70]"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-[50]">
        {/* Welcome Section */}
        <div className="text-center mb-12 animate-fadein">
          <h1 className="text-5xl font-extrabold font-mono mb-4">
            Welcome back, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user.displayName}</span>!
          </h1>
          <p className="text-xl text-gray-600 font-mono">Ready to organize your tasks and boost productivity?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Total Tasks</p>
                <p className="text-3xl font-bold font-mono group-hover:text-blue-600 transition-colors duration-200">{quickStats.totalTasks}</p>
              </div>
              <CheckSquare className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-600 font-mono text-sm">Completed</p>
                <p className="text-3xl font-bold font-mono text-green-600 group-hover:text-green-700 transition-colors duration-200">{quickStats.completedTasks}</p>
              </div>
              <PartyPopper className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Pending</p>
                <p className="text-3xl font-bold font-mono text-orange-600 group-hover:text-orange-700 transition-colors duration-200">{quickStats.pendingTasks}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 font-mono text-sm">Productivity</p>
                <p className="text-3xl font-bold font-mono text-purple-600 group-hover:text-purple-700 transition-colors duration-200">{quickStats.productivityScore}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform duration-200" />
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
                   const boards = workspaceBoards[workspace.id] || [];
                   return (
                     // Workspace Card Container
                     <div 
                       key={workspace.id} 
                       className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer animate-fadein group"
                       style={{ animationDelay: `${0.1 * index}s` }}
                       onClick={() => router.push(`/workspace/${workspace.id}`)}
                     >
                       {/* Workspace Header - Name and Action Buttons */}
                       <div className="flex items-center justify-between mb-4">
                         {/* Workspace Name and Color Dot */}
                         <div className="flex items-center space-x-3">
                           <div className={`w-3 h-3 rounded-full ${workspace.color} group-hover:scale-125 transition-transform duration-200`}></div>
                           <h3 className="font-mono font-bold text-xl text-gray-800 group-hover:text-blue-600 transition-colors duration-200">{workspace.name}</h3>
                         </div>
                         {/* Edit and Delete Action Buttons */}
                         <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                           {/* Edit Workspace Button */}
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               handleEditWorkspace(workspace);
                             }}
                             className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 rounded-lg"
                             title="Edit workspace"
                           >
                             <Edit className="w-4 h-4" />
                           </button>
                           {/* Delete Workspace Button */}
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               handleDeleteWorkspace(workspace);
                             }}
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 rounded-lg"
                             title="Delete workspace"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                       
                       {/* Workspace Description and Member Count */}
                       <div className="mb-4">
                         {/* Workspace Description */}
                         <p className="text-sm text-gray-600 font-mono mb-2 line-clamp-2">
                           {workspace.description || 'No description'}
                         </p>
                         {/* Member Count with Icon */}
                         <div className="flex items-center space-x-2 text-xs text-gray-500 font-mono">
                           <Users className="w-3 h-3" />
                           <span>{workspace.members.length} member{workspace.members.length !== 1 ? 's' : ''}</span>
                         </div>
                       </div>
                       
                       {/* Boards Section */}
                       {boards.length > 0 && (
                         <div className="pt-4 border-t border-gray-100">
                           {/* Boards Header */}
                           <div className="flex items-center justify-between mb-3">
                             <p className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wide">
                               Boards ({boards.length})
                             </p>
                           </div>
                           {/* Board Tags */}
                           <div className="flex flex-wrap gap-2">
                             {/* First 3 Board Tags */}
                             {boards.slice(0, 3).map((board) => (
                               <button
                                 key={board.id}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   router.push(`/workspace/${workspace.id}/board/${board.id}`);
                                 }}
                                 className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full font-mono transition-all duration-200 hover:scale-105"
                               >
                                 {board.name}
                               </button>
                             ))}
                             {/* "More Boards" Indicator */}
                             {boards.length > 3 && (
                               <span className="text-xs text-gray-500 font-mono px-3 py-1.5">
                                 +{boards.length - 3} more
                               </span>
                             )}
                           </div>
                         </div>
                       )}
                       
                       {/* Empty State - No Boards */}
                       {boards.length === 0 && (
                         <div className="pt-4 border-t border-gray-100">
                           <p className="text-xs font-mono text-gray-400 text-center py-2">
                             No boards yet
                           </p>
                         </div>
                       )}
                     </div>
                   );
                 })}
                 {(!isLoading && workspaces.length === 0) && (
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
                  onClick={handleCreateWorkspace}
                  className="w-full bg-black text-white p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Workspace</span>
                </button>
                
                <button
                  onClick={handleCreateBoard}
                  className={`w-full p-3 rounded-lg font-mono font-bold text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                    workspaces.length === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-sm' 
                      : 'bg-white text-black border-2 border-black hover:bg-gray-100 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                  disabled={workspaces.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  <span>{workspaces.length === 0 ? 'Create Board (Need Workspace)' : 'Create Board'}</span>
                </button>
                
                <button
                  onClick={handleInviteTeam}
                  className="w-full bg-white text-black border-2 border-gray-500 p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Users className="w-4 h-4" />
                  <span>Invite Team</span>
                </button>
                
                <button className="w-full bg-white text-black border-2 border-gray-300 p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl">
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

      {/* Create Workspace Modal */}
      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        type="workspace"
        onSubmit={handleCreateSubmit}
      />

      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={showCreateBoardModal}
        onClose={() => setShowCreateBoardModal(false)}
        onSubmit={handleCreateBoardSubmit}
        workspaces={workspaces}
      />

      {/* Edit Workspace Modal */}
      <EditWorkspaceModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        workspace={selectedWorkspace}
        onSubmit={handleEditSubmit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        workspace={selectedWorkspace}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Notification Drawer */}
      <NotificationPopup
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        userId={user?.uid || ''}
        onNotificationUpdate={updateNotificationCount}
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
        @keyframes spiral { 
          0% { 
            box-shadow: 0 0 0 0 #bbb; 
          } 
          50% { 
            box-shadow: 0 0 8px 2px #bbb; 
          } 
          100% { 
            box-shadow: 0 0 0 0 #bbb; 
          } 
        }
        .animate-spiral { 
          animation: spiral 2.5s infinite; 
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 font-mono">
          {error}
        </div>
      )}
    </div>
  );
} 