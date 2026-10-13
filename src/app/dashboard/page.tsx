'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Plus, Search, Bell, Users, BarChart3, ArrowUpDown, PartyPopper, CheckSquare, ListTodo, Clock, Edit, Trash2, X, ChevronDown, Target, TrendingUp, LogOut, CheckCircle, Info, AlertCircle, User, Grid3X3 } from 'lucide-react';
import { workspaceService, searchService, boardService, userService, taskService } from '@/lib/services';
import { enhancedNotificationService, Notification } from '@/lib/notificationService';
import { Workspace, QuickStats, Board, Task, CreateWorkspaceData } from '@/types';
import CreateModal from '@/components/CreateModal';

import EditWorkspaceModal from '@/components/EditWorkspaceModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import NotificationPopup from '@/components/NotificationPopup';
import SearchResults from '@/components/SearchResults';

export default function DashboardPage() {
  const { user, loading, logout, isFirebaseConfigured } = useAuth();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ workspaces: Workspace[]; }>({ workspaces: [] });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [selectedFilterWorkspace, setSelectedFilterWorkspace] = useState<string>('all');
  const [selectedFilterBoard, setSelectedFilterBoard] = useState<string>('all');

  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);

  // Function to load all tasks from all boards
  const loadAllTasks = useCallback(async (boardsData: Record<string, Board[]>) => {
    const allTasksArray: Task[] = [];
    
    for (const workspaceId in boardsData) {
      const boards = boardsData[workspaceId];
      for (const board of boards) {
        try {
          const tasks = await taskService.getTasks(board.id);
          // Add workspace and board info to each task for filtering
          const tasksWithMetadata = tasks.map(task => ({
            ...task,
            workspaceId,
            boardName: board.name,
          }));
          allTasksArray.push(...tasksWithMetadata);
        } catch (error) {
          console.error(`Error loading tasks for board ${board.id}:`, error);
        }
      }
    }
    
    setAllTasks(allTasksArray);
    
    // Get recent tasks (last 10 tasks, sorted by updatedAt)
    const sortedTasks = allTasksArray.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
    setRecentTasks(sortedTasks.slice(0, 10));
    
    calculateStats(allTasksArray);
  }, []);

  // Function to manually refresh all data
  const refreshData = useCallback(async () => {
    if (!user || !isFirebaseConfigured) return;
    
    try {
      // Reload workspaces and their boards
      const liveWorkspaces = await workspaceService.getWorkspaces(user.uid);
      setWorkspaces(liveWorkspaces);
      
      // Fetch boards for each workspace
      const boardsData: Record<string, Board[]> = {};
      for (const workspace of liveWorkspaces) {
        try {
          const boards = await boardService.getBoards(workspace.id);
          boardsData[workspace.id] = boards;
        } catch {
          boardsData[workspace.id] = [];
        }
      }
      setWorkspaceBoards(boardsData);
      
      // Load all tasks from all boards
      await loadAllTasks(boardsData);
      
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [user, isFirebaseConfigured, loadAllTasks]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Function to calculate stats based on filtered tasks
  const calculateStats = (tasks: Task[]) => {
    const totalTasks = tasks.length;
    
    // Define all possible completed column IDs
    const completedColumnIds = ['completed', 'done', 'resolved'];
    
    const completedTasks = tasks.filter(task => 
      task.status === 'completed' || completedColumnIds.includes(task.columnId.toLowerCase())
    );
    
    const pendingTasks = tasks.filter(task => 
      task.status !== 'completed' && !completedColumnIds.includes(task.columnId.toLowerCase())
    );
    
    const productivityScore = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
    
    // Stats calculation complete
    
    setQuickStats({
      totalTasks,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      productivityScore,
    });
  };

  // Effect to recalculate stats when filters change
  useEffect(() => {
    if (allTasks.length === 0) return;
    
    let filteredTasks = allTasks;
    
    // Filter by workspace
    if (selectedFilterWorkspace !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.workspaceId === selectedFilterWorkspace);
    }
    
    // Filter by board
    if (selectedFilterBoard !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.boardId === selectedFilterBoard);
    }
    
    calculateStats(filteredTasks);
  }, [allTasks, selectedFilterWorkspace, selectedFilterBoard]);

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
          } catch {
            boardsData[workspace.id] = [];
          }
        }
        setWorkspaceBoards(boardsData);
        
        // Load all tasks from all boards
        await loadAllTasks(boardsData);
        
        setIsLoading(false);
      })();
    });
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, isFirebaseConfigured, loadAllTasks]);

  // Auto-refresh when window gains focus (user comes back to dashboard)
  useEffect(() => {
    const handleFocus = () => {
      const timeSinceLastRefresh = Date.now() - lastRefresh;
      // Only refresh if it's been more than 30 seconds since last refresh
      if (timeSinceLastRefresh > 30000) {
        refreshData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [lastRefresh, refreshData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown="workspace"]') && !target.closest('[data-dropdown="board"]')) {
        setShowWorkspaceDropdown(false);
        setShowBoardDropdown(false);
      }
      // Close notification panel when clicking outside
      if (!target.closest('[data-notification-panel]') && !target.closest('[data-notification-button]')) {
        setShowNotificationPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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



  const handleCreateWorkspace = useCallback(() => {
    setShowCreateModal(true);
  }, []);



  const handleInviteTeam = useCallback(() => {
    // TODO: Implement team invitation
    // Feature coming soon
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



  // 2. Add error boundaries and user-friendly error messages for all async actions
  const handleCreateSubmit = useCallback(async (data: CreateWorkspaceData) => {
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
    } catch {
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
    // Workspace settings are owner-only; this mirrors the security rules.
    if (selectedWorkspace.ownerId !== user.uid) {
      setError('Only the workspace owner can edit workspace settings.');
      return;
    }
    setError(null);
    try {
      await workspaceService.updateWorkspace(selectedWorkspace.id, data);
    } catch {
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
    if (selectedWorkspace.ownerId !== user.uid) {
      setError('Only the workspace owner can delete this workspace.');
      setShowDeleteModal(false);
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      await workspaceService.deleteWorkspace(selectedWorkspace.id);
      setShowDeleteModal(false);
      setSelectedWorkspace(null);
    } catch {
      setError('Error deleting workspace. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [user, selectedWorkspace]);

  // Profile update handler
  const handleProfileUpdate = useCallback(async (displayName: string) => {
    if (!user) return;
    setError(null);
    setIsUpdatingProfile(true);
    
    try {
      // Update Firebase Auth profile
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(user, { displayName });
      
      // Update user document in Firestore if it exists
      try {
        await userService.updateUser(user.uid, { displayName });
      } catch (firestoreError) {
        console.warn('Could not update user document in Firestore:', firestoreError);
      }
      
      setShowEditProfileModal(false);
      
      // Create a notification for successful profile update
      try {
        await enhancedNotificationService.createNotificationSafe(
          user.uid,
          'welcomeMessage', // We'll reuse this template but with different text
          {},
          {},
          '/dashboard',
          false // Don't prevent duplicates for this one-time action
        );
      } catch (notificationError) {
        console.warn('Could not create profile update notification:', notificationError);
      }
      
      // Force a re-render by updating the page
      window.location.reload();
      
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Error updating profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [user]);

  // Create welcome notification for truly new users (only once)
  const createWelcomeNotification = useCallback(async () => {
    if (!user) return;

    try {
      // Only create welcome notification if user account is less than 1 day old
      const accountAge = Date.now() - new Date(user.metadata.creationTime || Date.now()).getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      if (accountAge < oneDayInMs) {
        await enhancedNotificationService.notifyWelcome(user.uid);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('index')) {
        console.warn('Firestore index not created yet. Welcome notification will be created once the index is available.');
      } else {
        console.error('Error creating welcome notification:', error);
      }
    }
  }, [user]);

  // Clean up duplicate notifications and create welcome for new users
  useEffect(() => {
    if (user && isFirebaseConfigured) {
      // Clean up any existing duplicates first
      enhancedNotificationService.cleanupDuplicateNotifications(user.uid)
        .then(() => {
          // Then create welcome notification if needed
          createWelcomeNotification();
        })
        .catch(error => {
          console.error('Error during notification cleanup:', error);
          // Still try to create welcome notification
          createWelcomeNotification();
        });
    }
  }, [user, isFirebaseConfigured, createWelcomeNotification]);

  // Function to load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const userNotifications = await enhancedNotificationService.getNotifications(user.uid, 20);
      setNotifications(userNotifications);
      const unreadCount = userNotifications.filter((n: Notification) => !n.read).length;
      setNotificationCount(unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    }
  }, [user]);

  // Function to update notification count
  const updateNotificationCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const unreadCount = await enhancedNotificationService.getUnreadCount(user.uid);
      setNotificationCount(unreadCount);
    } catch (error) {
      console.error('Error updating notification count:', error);
    }
  }, [user]);



  // Function to ensure user profile exists
  const ensureUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const userData = await userService.getUser(user.uid);
      if (!userData) {
        // The AuthContext should handle this, but let's double-check
        // User profile will be created by AuthContext
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
          <div className="text-black text-xl font-mono animate-pulse">Loading tasky...</div>
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



  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-200 via-pink-100 to-yellow-100 rounded-full blur-3xl opacity-60 animate-blob1 z-0" />
      <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-gradient-to-br from-pink-200 via-blue-100 to-yellow-100 rounded-full blur-2xl opacity-50 animate-blob2 z-0" />
      

      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-[60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <Image src="/tasky.svg" alt="Tasky Logo" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 transition-transform rounded-xl duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight">tasky</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 justify-end">
              {/* Search Bar */}
              <div className="relative z-[80] flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-3 h-3 sm:w-4 sm:h-4" />
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
                  className="pl-8 sm:pl-10 pr-8 sm:pr-4 py-2 sm:py-2.5 w-full border border-gray-300 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 bg-white/90 backdrop-blur-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchResults(false);
                      setSearchResults({ workspaces: [] });
                    }}
                    className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                )}
                {showSearchResults && (
                  <div className="relative z-[100]">
                    <SearchResults
                      results={searchResults}
                      query={searchQuery}
                      onCloseAction={handleCloseSearch}
                      onNavigateAction={handleSearchNavigate}
                    />
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => {
                    setShowNotificationPanel(!showNotificationPanel);
                    if (!showNotificationPanel) {
                      // Load notifications when opening panel
                      loadNotifications();
                    }
                  }}
                  className="relative p-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-all duration-200 z-[70]"
                  data-notification-button
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {/* Floating Notification Panel */}
                {showNotificationPanel && (
                  <div 
                    className="absolute top-12 right-0 w-96 max-h-[calc(100vh-8rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-[80] animate-fadeIn overflow-hidden"
                    data-notification-panel
                  >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 rounded-t-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                          <Bell className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="font-mono font-bold text-gray-900">Notifications</h3>
                          <p className="text-xs text-gray-600 font-mono">
                            {notifications.filter((n: Notification) => !n.read).length} unread
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowNotificationPanel(false)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <Bell className="w-6 h-6 text-gray-300" />
                          </div>
                          <p className="font-mono font-bold mb-1">No notifications</p>
                          <p className="text-sm text-center">You&apos;re all caught up!</p>
                        </div>
                      ) : (
                        <div className="p-3 space-y-3">
                          {notifications.slice(0, 5).map((notification: Notification, index: number) => (
                            <div
                              key={notification.id}
                              className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
                                notification.read 
                                  ? 'bg-gray-50 border-gray-200' 
                                  : 'bg-blue-50 border-blue-200'
                              }`}
                              style={{ animationDelay: `${index * 0.1}s` }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    {notification.type === 'success' && (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    )}
                                    {notification.type === 'info' && (
                                      <Info className="w-4 h-4 text-blue-500" />
                                    )}
                                    {notification.type === 'warning' && (
                                      <AlertCircle className="w-4 h-4 text-orange-500" />
                                    )}
                                    <h4 className="font-mono font-bold text-sm text-gray-900">
                                      {notification.title}
                                    </h4>
                                    {!notification.read && (
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-700 font-mono">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-500 font-mono mt-1">
                                    {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : 'Recently'}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1 ml-3">
                                  {!notification.read && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await enhancedNotificationService.markAsRead(notification.id);
                                          setNotifications(prev => 
                                            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                                          );
                                          setNotificationCount(prev => Math.max(0, prev - 1));
                                        } catch (error) {
                                          console.error('Error marking as read:', error);
                                        }
                                      }}
                                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                                      title="Mark as read"
                                    >
                                      <CheckCircle className="w-4 h-4 text-gray-400 hover:text-green-500" />
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      try {
                                        await enhancedNotificationService.deleteNotification(notification.id);
                                        setNotifications(prev => prev.filter(n => n.id !== notification.id));
                                        if (!notification.read) {
                                          setNotificationCount(prev => Math.max(0, prev - 1));
                                        }
                                      } catch (error) {
                                        console.error('Error deleting notification:', error);
                                      }
                                    }}
                                    className="p-1 hover:bg-red-100 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {notifications.length > 5 && (
                            <div className="text-center pt-2 border-t border-gray-200">
                              <p className="text-sm text-gray-500 font-mono">
                                Showing 5 of {notifications.length} notifications
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Panel Footer */}
                    {notifications.length > 0 && (
                      <div className="p-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-600 font-mono">
                            {notifications.length} total notifications
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={async () => {
                              try {
                                await enhancedNotificationService.markAllAsRead(user.uid);
                                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                setNotificationCount(0);
                              } catch (error) {
                                console.error('Error marking all as read:', error);
                              }
                            }}
                            className="flex-1 px-3 py-2 text-sm font-mono font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Mark all read</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await enhancedNotificationService.deleteAllNotifications(user.uid);
                                setNotifications([]);
                                setNotificationCount(0);
                              } catch (error) {
                                console.error('Error deleting all notifications:', error);
                              }
                            }}
                            className="flex-1 px-3 py-2 text-sm font-mono font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete all</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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



        {/* Stats Filter Controls */}
        <div className="mb-6">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-gray-600" />
                <h3 className="font-mono font-bold text-gray-900">Stats Filter</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Workspace Filter */}
                <div className="relative" data-dropdown="workspace">
                  <label className="block text-xs font-mono font-bold text-gray-700 mb-2">Workspace</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                      className="w-full bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 font-mono text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md min-w-[160px] text-left"
                    >
                      {selectedFilterWorkspace === 'all' 
                        ? '🌟 All Workspaces' 
                        : `📁 ${workspaces.find(w => w.id === selectedFilterWorkspace)?.name || 'Unknown'}`
                      }
                    </button>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Custom Dropdown */}
                    {showWorkspaceDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                        <div
                          onClick={() => {
                            setSelectedFilterWorkspace('all');
                            setSelectedFilterBoard('all');
                            setShowWorkspaceDropdown(false);
                          }}
                          className={`px-4 py-3 font-mono text-sm cursor-pointer transition-colors duration-150 ${
                            selectedFilterWorkspace === 'all' 
                              ? 'bg-gray-100 text-gray-900 font-bold' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          🌟 All Workspaces
                        </div>
                        {workspaces.map(workspace => (
                          <div
                            key={workspace.id}
                            onClick={() => {
                              setSelectedFilterWorkspace(workspace.id);
                              setSelectedFilterBoard('all');
                              setShowWorkspaceDropdown(false);
                            }}
                            className={`px-4 py-3 font-mono text-sm cursor-pointer transition-colors duration-150 ${
                              selectedFilterWorkspace === workspace.id 
                                ? 'bg-gray-100 text-gray-900 font-bold' 
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            📁 {workspace.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Board Filter */}
                <div className="relative" data-dropdown="board">
                  <label className="block text-xs font-mono font-bold text-gray-700 mb-2">Board</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                      className="w-full bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 font-mono text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md min-w-[160px] text-left"
                    >
                      {selectedFilterBoard === 'all' 
                        ? '📊 All Boards'
                        : (() => {
                            const allBoards = Object.values(workspaceBoards).flat();
                            const selectedBoard = allBoards.find(b => b.id === selectedFilterBoard);
                            return selectedBoard ? `🎯 ${selectedBoard.name}` : '📊 All Boards';
                          })()
                      }
                    </button>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showBoardDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Custom Dropdown */}
                    {showBoardDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                        <div
                          onClick={() => {
                            setSelectedFilterBoard('all');
                            setShowBoardDropdown(false);
                          }}
                          className={`px-4 py-3 font-mono text-sm cursor-pointer transition-colors duration-150 ${
                            selectedFilterBoard === 'all' 
                              ? 'bg-gray-100 text-gray-900 font-bold' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          📊 All Boards
                        </div>
                        {selectedFilterWorkspace === 'all' 
                          ? // Show all boards from all workspaces with workspace context
                            Object.entries(workspaceBoards).flatMap(([workspaceId, boards]) => {
                              const workspace = workspaces.find(w => w.id === workspaceId);
                              return boards.map(board => (
                                <div
                                  key={board.id}
                                  onClick={() => {
                                    setSelectedFilterBoard(board.id);
                                    setShowBoardDropdown(false);
                                  }}
                                  className={`px-4 py-3 font-mono text-sm cursor-pointer transition-colors duration-150 ${
                                    selectedFilterBoard === board.id 
                                      ? 'bg-gray-100 text-gray-900 font-bold' 
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  🎯 {board.name} <span className="text-gray-500">({workspace?.name || 'Unknown'})</span>
                                </div>
                              ));
                            })
                          : // Show only boards from selected workspace
                            (workspaceBoards[selectedFilterWorkspace] || []).map(board => (
                              <div
                                key={board.id}
                                onClick={() => {
                                  setSelectedFilterBoard(board.id);
                                  setShowBoardDropdown(false);
                                }}
                                className={`px-4 py-3 font-mono text-sm cursor-pointer transition-colors duration-150 ${
                                  selectedFilterBoard === board.id 
                                    ? 'bg-gray-100 text-gray-900 font-bold' 
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                🎯 {board.name}
                              </div>
                            ))
                        }
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Reset Filter Button */}
                {(selectedFilterWorkspace !== 'all' || selectedFilterBoard !== 'all') && (
                  <div className="relative">
                    <label className="block text-xs font-mono font-bold text-transparent mb-2">Reset</label>
                    <button
                      onClick={() => {
                        setSelectedFilterWorkspace('all');
                        setSelectedFilterBoard('all');
                      }}
                      className="px-4 py-3 text-sm font-mono font-medium text-gray-700 hover:text-gray-900 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl transition-all duration-200 border-2 border-red-200 hover:border-red-300 shadow-sm hover:shadow-md flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Reset</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Filter Summary */}
            {(selectedFilterWorkspace !== 'all' || selectedFilterBoard !== 'all') && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-mono text-gray-600">
                  Showing stats for: {' '}
                  <span className="font-bold text-gray-900">
                    {selectedFilterWorkspace !== 'all' 
                      ? workspaces.find(w => w.id === selectedFilterWorkspace)?.name || 'Unknown Workspace'
                      : 'All Workspaces'
                    }
                  </span>
                  {selectedFilterBoard !== 'all' && (
                    <>
                      {' > '}
                      <span className="font-bold text-gray-900">
                        {Object.values(workspaceBoards).flat().find(b => b.id === selectedFilterBoard)?.name || 'Unknown Board'}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-12">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-xs sm:text-sm">Total Tasks</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold font-mono group-hover:text-gray-700 transition-colors duration-200">{quickStats.totalTasks}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="h-1 bg-gray-200 rounded-full flex-1">
                    <div 
                      className="h-1 bg-gray-500 rounded-full transition-all duration-300"
                      style={{ width: quickStats.totalTasks > 0 ? '100%' : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-500 hidden sm:inline">
                    {(selectedFilterWorkspace !== 'all' || selectedFilterBoard !== 'all') ? 'Filtered' : 'All'}
                  </span>
                </div>
              </div>
              <CheckSquare className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-600 group-hover:scale-110 transition-transform duration-200 mt-2 sm:mt-0 self-end sm:self-auto" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-xs sm:text-sm">Completed</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-green-600 group-hover:text-green-700 transition-colors duration-200">{quickStats.completedTasks}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="h-1 bg-green-100 rounded-full flex-1">
                    <div 
                      className="h-1 bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: quickStats.totalTasks > 0 ? `${(quickStats.completedTasks / quickStats.totalTasks) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-mono text-green-600">
                    {quickStats.totalTasks > 0 ? Math.round((quickStats.completedTasks / quickStats.totalTasks) * 100) : 0}%
                  </span>
                </div>
              </div>
              <PartyPopper className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-500 group-hover:scale-110 transition-transform duration-200 mt-2 sm:mt-0 self-end sm:self-auto" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-xs sm:text-sm">Pending</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-orange-600 group-hover:text-orange-700 transition-colors duration-200">{quickStats.pendingTasks}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="h-1 bg-orange-100 rounded-full flex-1">
                    <div 
                      className="h-1 bg-orange-500 rounded-full transition-all duration-300"
                      style={{ width: quickStats.totalTasks > 0 ? `${(quickStats.pendingTasks / quickStats.totalTasks) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-mono text-orange-600">
                    {quickStats.totalTasks > 0 ? Math.round((quickStats.pendingTasks / quickStats.totalTasks) * 100) : 0}%
                  </span>
                </div>
              </div>
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-500 group-hover:scale-110 transition-transform duration-200 mt-2 sm:mt-0 self-end sm:self-auto" />
            </div>
          </div>
          
          <div className="bg-white/90 border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadein group hover:scale-105" style={{ animationDelay: '0.3s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-gray-600 font-mono text-xs sm:text-sm">Productivity</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-purple-600 group-hover:text-purple-700 transition-colors duration-200">{quickStats.productivityScore}%</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="h-1 bg-purple-100 rounded-full flex-1">
                    <div 
                      className={`h-1 rounded-full transition-all duration-300 ${
                        quickStats.productivityScore >= 80 ? 'bg-green-500' :
                        quickStats.productivityScore >= 60 ? 'bg-yellow-500' :
                        quickStats.productivityScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${quickStats.productivityScore}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${
                    quickStats.productivityScore >= 80 ? 'text-green-600' :
                    quickStats.productivityScore >= 60 ? 'text-yellow-600' :
                    quickStats.productivityScore >= 40 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {quickStats.productivityScore >= 80 ? 'Excellent' :
                     quickStats.productivityScore >= 60 ? 'Good' :
                     quickStats.productivityScore >= 40 ? 'Fair' : 'Poor'}
                  </span>
                </div>
              </div>
              <TrendingUp className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 group-hover:scale-110 transition-transform duration-200 mt-2 sm:mt-0 self-end sm:self-auto ${
                quickStats.productivityScore >= 80 ? 'text-green-500' :
                quickStats.productivityScore >= 60 ? 'text-yellow-500' :
                quickStats.productivityScore >= 40 ? 'text-orange-500' : 'text-red-500'
              }`} />
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
                       className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer animate-fadein border border-gray-100 hover:border-gray-200 hover:-translate-y-2 overflow-hidden"
                       style={{ animationDelay: `${0.1 * index}s` }}
                       onClick={() => router.push(`/workspace/${workspace.id}`)}
                     >
                       {/* Background Gradient */}
                       <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                       
                       {/* Content */}
                       <div className="relative z-10">
                         {/* Workspace Header - Name and Action Buttons */}
                         <div className="flex items-start justify-between mb-4">
                           {/* Workspace Name and Color Dot */}
                           <div className="flex items-center space-x-3">
                             <div className={`w-4 h-4 rounded-full ${workspace.color} shadow-lg group-hover:scale-125 group-hover:shadow-xl transition-all duration-300`}></div>
                             <h3 className="font-bold text-lg text-gray-800 group-hover:text-gray-900 transition-colors duration-200 line-clamp-1">{workspace.name}</h3>
                           </div>
                            {/* Edit and Delete are owner-only. The check mirrors
                                the security rules, which key both operations off
                                `workspaces/{id}.ownerId`. */}
                           <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                              {workspace.ownerId === user.uid && (
                                <>
                                  {/* Edit Workspace Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditWorkspace(workspace);
                                    }}
                                    className="relative w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:shadow-lg sm:hover:scale-110 transition-all duration-300 group/btn overflow-hidden"
                                    title="Edit workspace"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 opacity-0 sm:group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Edit className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 sm:group-hover/btn:text-blue-600 transition-colors duration-300" />
                                    </div>
                                  </button>
                                  {/* Delete Workspace Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteWorkspace(workspace);
                                    }}
                                    className="relative w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl hover:bg-red-50 hover:border-red-200 hover:shadow-lg sm:hover:scale-110 transition-all duration-300 group/btn overflow-hidden"
                                    title="Delete workspace"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 opacity-0 sm:group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 sm:group-hover/btn:text-red-600 transition-colors duration-300" />
                                    </div>
                                  </button>
                                </>
                              )}
                            </div>
                         </div>
                         
                         {/* Workspace Description */}
                         {workspace.description ? (
                           <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                             {workspace.description}
                           </p>
                         ) : (
                           <p className="text-gray-400 text-sm italic mb-6">No description</p>
                         )}
                         
                         {/* Stats Section */}
                         <div className="flex items-center justify-between mb-6">
                           <div className="flex items-center space-x-4">
                             {/* Members Count */}
                             <div className="flex items-center space-x-2 text-gray-500 group-hover:text-gray-600 transition-colors duration-200">
                               <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-200">
                                 <Users className="w-4 h-4 text-purple-600" />
                               </div>
                               <span className="text-sm font-medium">{workspace.members.length}</span>
                             </div>
                             {/* Boards Count */}
                             <div className="flex items-center space-x-2 text-gray-500 group-hover:text-gray-600 transition-colors duration-200">
                               <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                                 <Grid3X3 className="w-4 h-4 text-blue-600" />
                               </div>
                               <span className="text-sm font-medium">{boards.length}</span>
                             </div>
                           </div>
                           
                           {/* Arrow Icon */}
                           <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:scale-110 transition-all duration-300">
                             <svg className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                             </svg>
                           </div>
                         </div>
                         
                         {/* Boards Section */}
                         {boards.length > 0 && (
                           <div className="pt-4 border-t border-gray-200/60">
                             {/* Boards Header */}
                             <div className="flex items-center justify-between mb-4">
                               <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                 Recent Boards
                               </p>
                               <div className="text-xs text-gray-400 font-medium">
                                 {boards.length} total
                               </div>
                             </div>
                             {/* Board Tags */}
                             <div className="flex flex-wrap gap-2">
                               {/* First 3 Board Tags */}
                               {boards.slice(0, 3).map((board, index) => (
                                 <button
                                   key={board.id}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     router.push(`/workspace/${workspace.id}/board/${board.id}`);
                                   }}
                                   className="group/tag relative text-xs bg-white/90 backdrop-blur-sm border border-gray-200/80 hover:border-blue-300/80 px-3 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-md overflow-hidden"
                                   style={{ animationDelay: `${index * 0.1}s` }}
                                 >
                                   <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-300"></div>
                                   <div className="relative z-10">
                                     <span className="text-gray-700 group-hover/tag:text-gray-900 transition-colors duration-300">
                                       {board.name}
                                     </span>
                                   </div>
                                 </button>
                               ))}
                               {/* "More Boards" Indicator */}
                               {boards.length > 3 && (
                                 <div className="relative text-xs text-gray-500 font-medium px-3 py-2 bg-gradient-to-r from-gray-50/80 to-gray-100/80 backdrop-blur-sm rounded-xl border border-gray-200/60 overflow-hidden">
                                   <div className="absolute inset-0 bg-gradient-to-r from-gray-100/50 to-gray-200/50 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                                   <div className="relative z-10">
                                     <span>+{boards.length - 3} more</span>
                                   </div>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                         
                         {/* Empty State - No Boards */}
                         {boards.length === 0 && (
                           <div className="pt-4 border-t border-gray-200">
                             <div className="text-center py-3">
                               <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                                 <Plus className="w-4 h-4 text-gray-400" />
                               </div>
                               <p className="text-xs text-gray-400 font-medium">No boards yet</p>
                             </div>
                           </div>
                         )}
                       </div>
                       
                       {/* Hover Shine Effect */}
                       <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                         <div className="absolute top-0 -left-4 w-6 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
                       </div>
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
            
            {/* Recent Tasks */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 animate-fadein" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-black to-black rounded-xl flex items-center justify-center shadow-lg">
                    <ListTodo className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Recent Tasks</h2>
                </div>
              </div>
              
              {recentTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <ListTodo className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No tasks yet</h3>
                  <p className="text-gray-500 text-sm">Tasks will appear here as you create them</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentTasks.slice(0, 8).map((task) => {
                    const completedColumnIds = ['completed', 'done', 'resolved'];
                    const isCompleted = task.status === 'completed' || completedColumnIds.includes(task.columnId.toLowerCase());
                    
                    return (
                      <div
                        key={task.id}
                        className="group relative bg-gradient-to-r from-white to-gray-50/50 border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                        onClick={() => {
                          if (task.workspaceId && task.boardId) {
                            router.push(`/workspace/${task.workspaceId}/board/${task.boardId}`);
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
                                  {task.boardName || 'Unknown Board'}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                  isCompleted ? 'bg-green-100' :
                                  task.columnId === 'inprogress' || task.columnId === 'in-progress' ? 'bg-yellow-100' :
                                  'bg-gray-100'
                                }`}>
                                  <div className={`w-2 h-2 rounded-full ${
                                    isCompleted ? 'bg-green-500' :
                                    task.columnId === 'inprogress' || task.columnId === 'in-progress' ? 'bg-yellow-500' :
                                    'bg-gray-500'
                                  }`}></div>
                                </div>
                                <span className={`text-xs font-medium ${
                                  isCompleted ? 'text-green-600' :
                                  task.columnId === 'inprogress' || task.columnId === 'in-progress' ? 'text-yellow-600' :
                                  'text-gray-600'
                                }`}>
                                  {task.columnId === 'inprogress' || task.columnId === 'in-progress' ? 'progress' : task.columnId}
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
                <div className="flex justify-between gap-2 mt-4">
                  <button
                    onClick={() => setShowEditProfileModal(true)}
                    className="flex-1 bg-white text-black px-3 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 border-2 border-black hover:border-gray-400 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 bg-black text-white px-3 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
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
                  className="w-full bg-black text-white p-3 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Workspace</span>
                </button>
                

                <button
                  onClick={handleInviteTeam}
                  className="w-full bg-white text-black border-2 border-gray-500 p-3 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Users className="w-4 h-4" />
                  <span>Invite Team</span>
                </button>
                



              </div>
            </div>

            {/* Features Coming Soon */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.6s' }}>
              <h3 className="text-xl font-bold font-mono mb-4 text-gray-900">🚀 Coming Soon!</h3>
              <div className="space-y-3 text-sm font-mono">
                <div className="flex items-center space-x-2">
                  <ArrowUpDown className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">Drag & Drop Kanban Boards</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">Real-time Team Collaboration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">Advanced Analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateModal
        isOpen={showCreateModal}
        onCloseAction={() => setShowCreateModal(false)}
        type="workspace"
        onSubmitAction={handleCreateSubmit}
      />

      {/* Create Board Modal */}


      {/* Edit Workspace Modal */}
      <EditWorkspaceModal
        isOpen={showEditModal}
        onCloseAction={() => setShowEditModal(false)}
        workspace={selectedWorkspace}
        onSubmitAction={handleEditSubmit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onCloseAction={() => setShowDeleteModal(false)}
        workspace={selectedWorkspace}
        onConfirmAction={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Notification Drawer */}
      <NotificationPopup
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        userId={user?.uid || ''}
        onNotificationUpdate={updateNotificationCount}
      />

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setShowEditProfileModal(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-fadeIn border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold font-mono">Edit Profile</h2>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isUpdatingProfile}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const displayName = formData.get('displayName') as string;
                if (displayName.trim()) {
                  handleProfileUpdate(displayName.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="displayName" className="block text-sm font-mono font-bold text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  defaultValue={user?.displayName || ''}
                  required
                  maxLength={50}
                  disabled={isUpdatingProfile}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter your display name"
                />
                <p className="text-xs text-gray-500 font-mono mt-1">
                  This is how your name will appear to other users
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isUpdatingProfile ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      <span>Update Profile</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  disabled={isUpdatingProfile}
                  className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-100 hover:border-black border-2 border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* CSS Animations */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
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