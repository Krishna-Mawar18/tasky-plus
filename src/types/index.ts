export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;
  ownerId: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  columns: Column[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  columnId: string;
  boardId: string;
  workspaceId: string;
  // Optional properties added during data loading for UI purposes
  boardName?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

export interface QuickStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  productivityScore: number;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  color: string;
}

export interface CreateBoardData {
  name: string;
  description?: string;
} 