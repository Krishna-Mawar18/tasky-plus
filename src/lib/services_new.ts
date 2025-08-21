import { db } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { Workspace, Board, Task, QuickStats } from '@/types';

// Workspace Services
export const workspaceService = {
  async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = await addDoc(collection(db, 'workspaces'), {
      ...workspace,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getWorkspaces(userId: string): Promise<Workspace[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'workspaces'),
      where('members', 'array-contains', userId)
    );
    const snapshot = await getDocs(q);
    const workspaces = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Workspace[];
    
    // Sort by updatedAt on the client side
    return workspaces.sort((a, b) => {
      if (!a.updatedAt || !b.updatedAt) return 0;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  },

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'workspaces', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteWorkspace(id: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    await deleteDoc(doc(db, 'workspaces', id));
  },

  subscribeToWorkspaces(userId: string, callback: (workspaces: Workspace[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, 'workspaces'),
      where('members', 'array-contains', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const workspaces = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Workspace[];
      
      // Sort by updatedAt on the client side
      const sortedWorkspaces = workspaces.sort((a, b) => {
        if (!a.updatedAt || !b.updatedAt) return 0;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      callback(sortedWorkspaces);
    });
  },
};

// Board Services
export const boardService = {
  async createBoard(board: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = await addDoc(collection(db, 'boards'), {
      ...board,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getBoards(workspaceId: string): Promise<Board[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'boards'),
      where('workspaceId', '==', workspaceId)
    );
    const snapshot = await getDocs(q);
    const boards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Board[];
    
    // Sort by updatedAt on the client side
    return boards.sort((a, b) => {
      if (!a.updatedAt || !b.updatedAt) return 0;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  },

  async updateBoard(id: string, updates: Partial<Board>): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'boards', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteBoard(id: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    await deleteDoc(doc(db, 'boards', id));
  },

  subscribeToBoards(workspaceId: string, callback: (boards: Board[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, 'boards'),
      where('workspaceId', '==', workspaceId)
    );
    return onSnapshot(q, (snapshot) => {
      const boards = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Board[];
      
      // Sort by updatedAt on the client side
      const sortedBoards = boards.sort((a, b) => {
        if (!a.updatedAt || !b.updatedAt) return 0;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      callback(sortedBoards);
    });
  },
};

// Task Services
export const taskService = {
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...task,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getTasks(boardId: string): Promise<Task[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'tasks'),
      where('boardId', '==', boardId)
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      dueDate: doc.data().dueDate ? doc.data().dueDate.toDate() : null,
    })) as Task[];
    
    // Sort by createdAt on the client side
    return tasks.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'tasks', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteTask(id: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    await deleteDoc(doc(db, 'tasks', id));
  },

  async moveTask(taskId: string, newColumnId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'tasks', taskId);
    await updateDoc(docRef, {
      columnId: newColumnId,
      updatedAt: serverTimestamp(),
    });
  },

  subscribeToTasks(boardId: string, callback: (tasks: Task[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, 'tasks'),
      where('boardId', '==', boardId)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        dueDate: doc.data().dueDate ? doc.data().dueDate.toDate() : null,
      })) as Task[];
      
      // Sort by createdAt on the client side
      const sortedTasks = tasks.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      callback(sortedTasks);
    });
  },
};

// Search Services
export const searchService = {
  async searchAll(userId: string, searchQuery: string) {
    if (!db || !searchQuery.trim()) return { workspaces: [], boards: [], tasks: [] };
    
    const searchTerm = searchQuery.toLowerCase();
    
    // Search workspaces
    const workspacesQuery = query(
      collection(db, 'workspaces'),
      where('members', 'array-contains', userId)
    );
    const workspacesSnapshot = await getDocs(workspacesQuery);
    const workspaces = workspacesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Workspace))
      .filter(workspace => 
        workspace.name.toLowerCase().includes(searchTerm) ||
        workspace.description?.toLowerCase().includes(searchTerm)
      );

    // Search boards
    const boardsQuery = query(collection(db, 'boards'));
    const boardsSnapshot = await getDocs(boardsQuery);
    const boards = boardsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Board))
      .filter(board => 
        board.name.toLowerCase().includes(searchTerm) ||
        board.description?.toLowerCase().includes(searchTerm)
      );

    // Search tasks
    const tasksQuery = query(collection(db, 'tasks'));
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasks = tasksSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Task))
      .filter(task => 
        task.title.toLowerCase().includes(searchTerm) ||
        task.description?.toLowerCase().includes(searchTerm) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );

    return { workspaces, boards, tasks };
  },
};

// Notification Services
export const notificationService = {
  async getNotifications(userId: string) {
    if (!db) return [];
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));
  },

  async markAsRead(notificationId: string) {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  },

  async deleteNotification(notificationId: string) {
    if (!db) throw new Error('Firebase not configured');
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
  },

  async createNotification(notification: { userId: string; title: string; message: string; type: string; read: boolean }) {
    if (!db) throw new Error('Firebase not configured');
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: serverTimestamp(),
    });
  },
};

// Stats Services
export const statsService = {
  async getQuickStats(userId: string): Promise<QuickStats> {
    if (!db) return { totalTasks: 0, completedTasks: 0, pendingTasks: 0, productivityScore: 0 };
    const q = query(
      collection(db, 'tasks'),
      where('assigneeId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(doc => doc.data()) as Task[];
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const pendingTasks = totalTasks - completedTasks;
    const productivityScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      productivityScore,
    };
  },
};
