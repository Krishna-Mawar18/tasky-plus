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
  arrayRemove,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { Workspace, WorkspaceMember, WorkspaceRole, Board, Task, QuickStats, TaskOrderUpdate } from '@/types';
import { enhancedNotificationService } from './notificationService';
import { gridOrders, isMissingOrder, sortTasksByOrder, tasksInColumn } from './taskOrder';
import { isWorkspaceRole } from './permissions';
import { MemberOperationError } from './memberErrors';
import { lookupUserByEmail, normalizeEmail } from './userEmailIndex';

/** Firestore caps a single batch at 500 writes. */
const FIRESTORE_BATCH_LIMIT = 450;

// Workspace Services
export const workspaceService = {
  /**
   * Create a workspace, then its owner's membership document, then record the
   * workspace on the owner's user document.
   *
   * Deliberately sequential rather than one batch: a rule cannot see a sibling
   * write in the same batch, so the membership document would be evaluated
   * before the workspace it belongs to exists. If the second step ever fails,
   * `ensureOwnerMembership` repairs it the next time the owner opens it.
   */
  async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) {
      console.error('Firestore database is not initialized');
      throw new Error('Firebase not configured');
    }

    try {
      const workspaceRef = await addDoc(collection(db, 'workspaces'), {
        ...workspace,
        // The UID list is derived from the members subcollection, never the
        // other way round.
        members: [workspace.ownerId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(memberDocRef(workspaceRef.id, workspace.ownerId), {
        uid: workspace.ownerId,
        role: 'owner',
        email: null,
        displayName: null,
        photoURL: null,
        addedBy: workspace.ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', workspace.ownerId), {
        workspaces: arrayUnion(workspaceRef.id),
        updatedAt: serverTimestamp(),
      });

      // Send notification for workspace creation
      try {
        await enhancedNotificationService.notifyWorkspaceCreated(
          workspace.ownerId,
          workspace.name,
          workspaceRef.id
        );
      } catch (notificationError) {
        console.warn('Failed to send workspace creation notification:', notificationError);
      }

      return workspaceRef.id;
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

  /**
   * Delete a workspace together with its membership documents.
   *
   * Firestore rules cannot cascade, so the `members` subcollection is cleaned up
   * in the same batch rather than being left behind as orphans.
   */
  async deleteWorkspace(id: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');

    const membersSnapshot = await getDocs(collection(db, 'workspaces', id, 'members'));
    const batch = writeBatch(db);
    membersSnapshot.docs.forEach((member) => batch.delete(member.ref));
    batch.delete(doc(db, 'workspaces', id));
    await batch.commit();
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

// Member Services

/** `workspaces/{workspaceId}/members/{uid}` — the authoritative membership record. */
function memberDocRef(workspaceId: string, uid: string) {
  return doc(db!, 'workspaces', workspaceId, 'members', uid);
}

/**
 * Map a membership snapshot into the `WorkspaceMember` shape.
 *
 * An unrecognised or missing role becomes `null` so callers cannot mistake a
 * corrupt document for elevated access.
 */
function toWorkspaceMember(snapshot: {
  id: string;
  data: () => Record<string, unknown>;
}): WorkspaceMember | null {
  const data = snapshot.data();
  const role = data.role;
  if (!isWorkspaceRole(role)) return null;

  return {
    uid: String(data.uid ?? snapshot.id),
    role,
    email: (data.email as string | null) ?? null,
    displayName: (data.displayName as string | null) ?? null,
    photoURL: (data.photoURL as string | null) ?? null,
    addedBy: data.addedBy as string | undefined,
    addedByEmail: (data.addedByEmail as string | null) ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/** Owner first, then managers, then viewers; alphabetical by display name. */
function sortMembers(a: WorkspaceMember, b: WorkspaceMember): number {
  const weight = { owner: 0, manager: 1, viewer: 2 } as const;
  if (weight[a.role] !== weight[b.role]) return weight[a.role] - weight[b.role];
  return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
}

export const memberService = {
  /**
   * Role of a single user in a workspace, or `null` when they are not a member.
   *
   * This is the read the UI uses to decide which controls to render. A
   * `permission-denied` result is treated as "not a member" rather than an
   * error, since it simply means the caller cannot see that membership.
   */
  async getRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    if (!db) return null;
    try {
      const snapshot = await getDoc(memberDocRef(workspaceId, userId));
      if (!snapshot.exists()) return null;
      const role = snapshot.data().role;
      return isWorkspaceRole(role) ? role : null;
    } catch (error) {
      console.error('Error reading workspace role:', error);
      return null;
    }
  },

  /** Every membership in a workspace, ordered owner first then by name. */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'workspaces', workspaceId, 'members'));
    return snapshot.docs
      .map(toWorkspaceMember)
      .filter((member): member is WorkspaceMember => member !== null)
      .sort(sortMembers);
  },

  /**
   * Live member list.
   *
   * `onError` matters as much as the callback: for a non-member the rules reject
   * the read, and without it the caller is left waiting on a snapshot that will
   * never arrive.
   */
  subscribeToMembers(
    workspaceId: string,
    callback: (members: WorkspaceMember[]) => void,
    onError?: (error: unknown) => void,
  ) {
    if (!db) {
      onError?.(new MemberOperationError('firebase-not-configured'));
      return () => {};
    }
    return onSnapshot(
      collection(db, 'workspaces', workspaceId, 'members'),
      (snapshot) => {
        callback(
          snapshot.docs
            .map(toWorkspaceMember)
            .filter((member): member is WorkspaceMember => member !== null)
            .sort(sortMembers),
        );
      },
      (error) => {
        console.error('Error subscribing to workspace members:', error);
        onError?.(error);
      },
    );
  },

  /**
   * Add a member by email address.
   *
   * The email is resolved through `userEmailIndex`, then the membership
   * document, the workspace's derived UID list and the new member's own
   * `workspaces` array are written in a single batch, so a member can never end
   * up half-added.
   *
   * Every condition the rules will enforce is checked here first, because a
   * refused batch comes back as an undifferentiated `permission-denied`. Without
   * these checks a manager adding themselves, or a caller whose membership record
   * the rules no longer accept, is both told their role is wrong and left with no
   * way to tell what to fix.
   */
  async addMember(input: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    addedBy: string;
    addedByEmail?: string | null;
  }): Promise<void> {
    if (!db) throw new MemberOperationError('firebase-not-configured');
    if (input.role === 'owner') throw new MemberOperationError('invalid-role');

    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@')) throw new MemberOperationError('invalid-email');

    const profile = await lookupUserByEmail(email);
    if (!profile) throw new MemberOperationError('user-not-found');

    // The rules refuse this write, so catching it here turns an opaque
    // permission error into something the person can act on.
    if (profile.uid === input.addedBy) throw new MemberOperationError('cannot-add-self');

    const existing = await getDoc(memberDocRef(input.workspaceId, profile.uid));
    if (existing.exists()) throw new MemberOperationError('already-member');

    // Confirm the caller is who the UI believes they are before the batch, so a
    // stale role in the client cannot be reported as a server-side problem.
    // Adding a member is owner-only: a manager has no membership write path.
    const workspace = await getDoc(doc(db, 'workspaces', input.workspaceId));
    const callerIsOwner = workspace.exists() && workspace.data()?.ownerId === input.addedBy;
    if (!callerIsOwner) {
      const callerRole = await this.getRole(input.workspaceId, input.addedBy);
      throw new MemberOperationError(
        callerRole === null ? 'membership-record-missing' : 'insufficient-permission',
      );
    }

    const batch = writeBatch(db);
    batch.set(memberDocRef(input.workspaceId, profile.uid), {
      uid: profile.uid,
      role: input.role,
      email,
      displayName: profile.displayName ?? null,
      photoURL: profile.photoURL ?? null,
      addedBy: input.addedBy,
      addedByEmail: input.addedByEmail ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'workspaces', input.workspaceId), {
      members: arrayUnion(profile.uid),
      updatedAt: serverTimestamp(),
    });
    // Only the workspace list is touched on the target's user document: their
    // profile is owned by their own sign-in, and rewriting it here would let the
    // owner overwrite someone else's display name. The profile is denormalised
    // onto the membership document instead.
    batch.set(
      doc(db, 'users', profile.uid),
      {
        uid: profile.uid,
        workspaces: arrayUnion(input.workspaceId),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await batch.commit();
  },

  /**
   * Fill in the caller's own display fields on their membership document.
   *
   * Membership documents created before the profile was denormalised onto them
   * render as "Unknown user" with a raw UID, and nothing else can repair them:
   * the rules deliberately refuse cross-user profile reads, because that would
   * expose every co-member's address to the whole workspace. Each person can
   * therefore only fix their own row, which is exactly what this does.
   *
   * Best effort by design — a failure here must never cost somebody their
   * access, so it is logged and swallowed rather than thrown.
   */
  async syncOwnMemberProfile(
    workspaceId: string,
    userId: string,
    profile: { email: string | null; displayName?: string | null; photoURL?: string | null },
  ): Promise<void> {
    if (!db) return;

    try {
      const ref = memberDocRef(workspaceId, userId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) return;

      const current = snapshot.data();
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      let dirty = false;

      const wanted = {
        email: profile.email,
        displayName: profile.displayName ?? null,
        photoURL: profile.photoURL ?? null,
      };

      for (const [field, value] of Object.entries(wanted)) {
        // Only ever fills a gap, or corrects a stale value the owner of the
        // document can prove from their own auth token.
        if (value == null || value === '') continue;
        if (current[field] !== value) {
          patch[field] = value;
          dirty = true;
        }
      }

      if (!dirty) return;
      await updateDoc(ref, patch);
    } catch (error) {
      console.error('Could not refresh own member profile:', error);
    }
  },

  /**
   * Remove a member and their derived entries.
   *
   * Owner-only, and the rules reject any attempt to remove the workspace owner,
   * so this cannot leave a workspace without an owner.
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    if (!db) throw new MemberOperationError('firebase-not-configured');

    const batch = writeBatch(db);
    batch.delete(memberDocRef(workspaceId, userId));
    batch.update(doc(db, 'workspaces', workspaceId), {
      members: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  },

  /** Change a member's role. Owner-only; `owner` is not a valid target. */
  async changeRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    if (!db) throw new MemberOperationError('firebase-not-configured');
    if (role === 'owner') throw new MemberOperationError('invalid-role');

    await updateDoc(memberDocRef(workspaceId, userId), {
      role,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Create the caller's own owner membership if it is missing.
   *
   * Workspaces created before memberships existed have no `members/{uid}`
   * document. This may only ever create a document for the workspace owner, and
   * only ever with the `owner` role, so calling it is a data repair rather than
   * a way to grant access. Safe to call on every workspace load.
   *
   * Three outcomes, deliberately distinguished:
   * - a readable membership with a valid role -> that role
   * - no document at all -> create one (rules allow exactly this repair)
   * - a document that exists but is unreadable or has an unrecognised role ->
   *   the rules refuse the write, because repairing a corrupt role in place
   *   would be indistinguishable from tampering. That needs an operator.
   */
  async ensureOwnerMembership(
    workspaceId: string,
    ownerId: string,
    profile?: { email: string | null; displayName?: string | null; photoURL?: string | null },
  ): Promise<WorkspaceRole | null> {
    if (!db) return null;

    const existing = await memberService.getRole(workspaceId, ownerId);
    if (existing) return existing;

    const ref = memberDocRef(workspaceId, ownerId);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      throw new MemberOperationError('insufficient-permission');
    }

    await setDoc(ref, {
      uid: ownerId,
      role: 'owner',
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
      photoURL: profile?.photoURL ?? null,
      addedBy: ownerId,
      addedByEmail: profile?.email ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return 'owner';
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
