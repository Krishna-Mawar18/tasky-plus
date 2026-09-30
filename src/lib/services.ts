import { db } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { Workspace, Board, Task, QuickStats, TaskOrderUpdate } from '@/types';
import { enhancedNotificationService } from './notificationService';
import { gridOrders, isMissingOrder, sortTasksByOrder, tasksInColumn } from './taskOrder';

/** Firestore caps a single batch at 500 writes. */
const FIRESTORE_BATCH_LIMIT = 450;

// Workspace Services
export const workspaceService = {
  async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) {
      console.error('Firestore database is not initialized');
      throw new Error('Firebase not configured');
    }
    
    try {
      // Create the workspace
      const docRef = await addDoc(collection(db, 'workspaces'), {
        ...workspace,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Update user's workspaces array
      const userRef = doc(db, 'users', workspace.ownerId);
      await updateDoc(userRef, {
        workspaces: arrayUnion(docRef.id),
        updatedAt: serverTimestamp(),
      });
      
      // Send notification for workspace creation
      try {
        await enhancedNotificationService.notifyWorkspaceCreated(
          workspace.ownerId,
          workspace.name,
          docRef.id
        );
      } catch (notificationError) {
        console.warn('Failed to send workspace creation notification:', notificationError);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  },

  async getWorkspaces(userId: string): Promise<Workspace[]> {
    if (!db) {
      console.error('Firestore database is not initialized');
      return [];
    }
    
    try {
      // First, get user's workspace list
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userWorkspaces = userSnap.exists() ? userSnap.data().workspaces || [] : [];
      
      // Also query workspaces where user is a member
      const q = query(
        collection(db, 'workspaces'),
        where('members', 'array-contains', userId)
      );
      const snapshot = await getDocs(q);
      
      // Combine both approaches to get all workspaces
      const workspaceIds = new Set([...userWorkspaces]);
      snapshot.docs.forEach(doc => workspaceIds.add(doc.id));
      
      // Fetch all workspaces
      const workspaces: Workspace[] = [];
      for (const workspaceId of workspaceIds) {
        try {
          const workspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId));
          if (workspaceDoc.exists()) {
            const workspaceData = workspaceDoc.data();
            workspaces.push({
              id: workspaceDoc.id,
              ...workspaceData,
              createdAt: workspaceData.createdAt?.toDate(),
              updatedAt: workspaceData.updatedAt?.toDate(),
            } as Workspace);
          }
        } catch (error) {
          console.error(`Error fetching workspace ${workspaceId}:`, error);
        }
      }
      
      // Sort by updatedAt on the client side
      const sortedWorkspaces = workspaces.sort((a, b) => {
        if (!a.updatedAt || !b.updatedAt) return 0;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      
      return sortedWorkspaces;
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      return [];
    }
  },

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    if (!db) {
      console.error('Firestore database is not initialized');
      return null;
    }
    
    try {
      const docRef = doc(db, 'workspaces', workspaceId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Workspace;
      }
      return null;
    } catch (error) {
      console.error('Error fetching workspace:', error);
      return null;
    }
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

  async getBoardsByWorkspace(workspaceId: string): Promise<Board[]> {
    return this.getBoards(workspaceId);
  },

  async getBoard(boardId: string): Promise<Board | null> {
    if (!db) return null;
    const docRef = doc(db, 'boards', boardId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
    } as Board;
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
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'> & { order?: number }): Promise<string> {
    if (!db) throw new Error('Firebase not configured');

    // Append to the end of the target column. Only touches one document.
    let order = task.order;
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      order = await this.getNextOrderInColumn(task.boardId, task.columnId);
    }
    
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...task,
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Send notification if task is assigned to someone
    if (task.assigneeId && task.assigneeId !== task.assigneeName) {
      try {
        await enhancedNotificationService.notifyTaskAssigned(
          task.assigneeId,
          task.title,
          task.assigneeName || 'Someone',
          task.workspaceId || '',
          task.boardId,
          docRef.id
        );
      } catch (notificationError) {
        console.warn('Failed to send task assignment notification:', notificationError);
      }
    }
    
    return docRef.id;
  },

  async getTasksByBoard(boardId: string): Promise<Task[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'tasks'),
      where('boardId', '==', boardId)
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(toTask);
    return sortTasksByOrder(tasks);
  },

  async getTasks(boardId: string): Promise<Task[]> {
    return this.getTasksByBoard(boardId);
  },

  /**
   * Next `order` for a task appended to a column.
   *
   * Callers that already hold the board in memory should pass `order`
   * themselves; this fallback exists for callers that do not. It uses the
   * single-field `boardId` filter so it never depends on a composite index
   * being deployed.
   */
  async getNextOrderInColumn(boardId: string, columnId: string): Promise<number> {
    const columnTasks = tasksInColumn(await this.getTasksByBoard(boardId), columnId);
    const last = columnTasks[columnTasks.length - 1];
    return last && Number.isFinite(last.order) ? last.order + 1000 : 1000;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    
    // Get the current task to check for changes
    const currentTaskDoc = await getDoc(doc(db, 'tasks', id));
    const currentTask = currentTaskDoc.exists() ? currentTaskDoc.data() as Task : null;
    
    const docRef = doc(db, 'tasks', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    
    // Send notifications for relevant changes
    if (currentTask) {
      try {
        // Notify if task is completed
        if (updates.status === 'completed' && currentTask.status !== 'completed') {
          await enhancedNotificationService.createNotification(
            currentTask.assigneeId || currentTask.workspaceId || '',
            'taskCompleted',
            { taskTitle: currentTask.title },
            { 
              taskId: id, 
              workspaceId: currentTask.workspaceId, 
              boardId: currentTask.boardId 
            },
            `/workspace/${currentTask.workspaceId}/board/${currentTask.boardId}`
          );
        }
        
        // Notify if task is reassigned
        if (updates.assigneeId && updates.assigneeId !== currentTask.assigneeId) {
          await enhancedNotificationService.notifyTaskAssigned(
            updates.assigneeId,
            currentTask.title,
            updates.assigneeName || 'Someone',
            currentTask.workspaceId || '',
            currentTask.boardId,
            id
          );
        }
      } catch (notificationError) {
        console.warn('Failed to send task update notification:', notificationError);
      }
    }
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

  /**
   * Persist the result of a drag in a single write batch.
   *
   * A plain reorder sends one document. A rebalance (only triggered once a
   * column's order values are too dense to split) sends one document per task
   * in that column, still as a single atomic batch.
   */
  async applyTaskMoves(updates: TaskOrderUpdate[]): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    if (updates.length === 0) return;

    const firestore = db;
    for (let index = 0; index < updates.length; index += FIRESTORE_BATCH_LIMIT) {
      const chunk = updates.slice(index, index + FIRESTORE_BATCH_LIMIT);
      const batch = writeBatch(firestore);
      chunk.forEach(({ taskId, columnId, order, status }) => {
        batch.update(doc(firestore, 'tasks', taskId), {
          columnId,
          order,
          ...(status ? { status } : {}),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  },

  /**
   * Backfill `order` on tasks created before ordering existed.
   *
   * Runs once per board load, only touches documents that are actually missing
   * the field, and leaves the caller's UI untouched — the reader already sorts
   * legacy tasks by `createdAt`, so this is purely a data repair.
   */
  async migrateMissingTaskOrders(tasks: Task[]): Promise<number> {
    if (!db) return 0;

    const legacy = tasks.filter(isMissingOrder);
    if (legacy.length === 0) return 0;

    const updates: TaskOrderUpdate[] = [];
    const columnIds = new Set(legacy.map((task) => task.columnId));

    columnIds.forEach((columnId) => {
      const columnTasks = sortTasksByOrder(legacy.filter((task) => task.columnId === columnId));
      gridOrders(columnTasks.length).forEach((order, index) => {
        updates.push({ taskId: columnTasks[index].id, columnId, order });
      });
    });

    try {
      await this.applyTaskMoves(updates);
      return updates.length;
    } catch (error) {
      // Never block the board on a repair write.
      console.warn('Failed to migrate missing task orders:', error);
      return 0;
    }
  },

  subscribeToTasks(boardId: string, callback: (tasks: Task[]) => void) {
    if (!db) return () => {};
    const q = query(
      collection(db, 'tasks'),
      where('boardId', '==', boardId)
    );
    return onSnapshot(q, (snapshot) => {
      callback(sortTasksByOrder(snapshot.docs.map(toTask)));
    });
  },
};

/** Map a Firestore task snapshot into the `Task` shape used by the UI. */
function toTask(snapshot: { id: string; data: () => Record<string, unknown> }): Task {
  const data = snapshot.data();
  return {
    ...(data as unknown as Task),
    id: snapshot.id,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    dueDate: data.dueDate ? toDate(data.dueDate) : null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
  };
}

function toDate(value: unknown): Date {
  return typeof (value as { toDate?: () => Date })?.toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : new Date(0);
}

// Search Services
export const searchService = {
  async searchAll(userId: string, searchQuery: string) {
    if (!db || !searchQuery.trim()) {
      return { workspaces: [], boards: [] };
    }

    const searchTerm = searchQuery.toLowerCase().trim();

    // Search workspaces only
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

    return { workspaces, boards: [] };
  },
};

// Notification Services
export const notificationService = {
  async getNotifications(userId: string) {
    if (!db) return [];
    try {
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
    } catch (error: unknown) {
      // If index doesn't exist, fallback to simple query without ordering
      if ((error as { code?: string; message?: string })?.code === 'failed-precondition' || (error as { code?: string; message?: string })?.message?.includes('index')) {
        console.warn('Firestore index not found, using fallback query for notifications');
        const fallbackQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(fallbackQuery);
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        }));
        // Sort on client side as fallback
        return notifications.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      }
      throw error;
    }
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

// User Services
export const userService = {
  async getUser(userId: string) {
    if (!db) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return {
          id: userDoc.id,
          ...userDoc.data(),
          createdAt: userDoc.data().createdAt?.toDate(),
          updatedAt: userDoc.data().updatedAt?.toDate(),
          lastLogin: userDoc.data().lastLogin?.toDate(),
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  async updateUser(userId: string, updates: Partial<{ displayName: string; email: string; photoURL: string }>) {
    if (!db) throw new Error('Firebase not configured');
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async addWorkspaceToUser(userId: string, workspaceId: string) {
    if (!db) throw new Error('Firebase not configured');
    try {
      await updateDoc(doc(db, 'users', userId), {
        workspaces: arrayUnion(workspaceId),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding workspace to user:', error);
      throw error;
    }
  },
};
