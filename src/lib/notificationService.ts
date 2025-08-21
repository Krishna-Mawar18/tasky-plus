'use client';

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
  limit
} from 'firebase/firestore';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'task' | 'workspace' | 'system' | 'reminder';
  read: boolean;
  actionUrl?: string;
  metadata?: {
    taskId?: string;
    workspaceId?: string;
    boardId?: string;
    assignerId?: string;
    assignerName?: string;
  };
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationTemplate {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'task' | 'workspace' | 'system' | 'reminder';
}

// Enhanced notification service
export class EnhancedNotificationService {
  private unsubscribeCallbacks: (() => void)[] = [];

  private templates: Record<string, NotificationTemplate> = {
    taskAssigned: {
      title: 'Task Assigned',
      message: 'You have been assigned to "{taskTitle}" by {assignerName}',
      type: 'info',
      category: 'task'
    },
    taskCompleted: {
      title: 'Task Completed',
      message: 'Great job! Task "{taskTitle}" has been completed',
      type: 'success',
      category: 'task'
    },
    workspaceCreated: {
      title: 'Workspace Created',
      message: 'Your workspace "{workspaceName}" is ready! Start adding boards and tasks.',
      type: 'success',
      category: 'workspace'
    },
    welcomeMessage: {
      title: 'Welcome to tasky!',
      message: 'Welcome to your productivity hub! Create your first workspace to get started.',
      type: 'success',
      category: 'system'
    },
    // Remove the repetitive ones by not creating them
    taskReminder: {
      title: 'Task Reminder',
      message: 'You have {pendingCount} pending tasks that need attention',
      type: 'warning',
      category: 'reminder'
    },
    featureAnnouncement: {
      title: 'New Feature Available',
      message: 'New features have been added to improve your experience',
      type: 'info',
      category: 'system'
    }
  };

  async createNotification(
    userId: string, 
    templateKey: string, 
    replacements: Record<string, string> = {},
    metadata?: Notification['metadata'],
    actionUrl?: string
  ): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    
    const template = this.templates[templateKey];
    if (!template) throw new Error(`Notification template "${templateKey}" not found`);

    let title = template.title;
    let message = template.message;
    
    Object.entries(replacements).forEach(([key, value]) => {
      title = title.replace(new RegExp(`{${key}}`, 'g'), value);
      message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    const notificationData = {
      userId,
      title,
      message,
      type: template.type,
      category: template.category,
      read: false,
      actionUrl,
      metadata: metadata || {},
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  async getNotifications(userId: string, limitCount: number = 20): Promise<Notification[]> {
    if (!db) return [];
    
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Notification[];
    } catch (error: unknown) {
      console.warn('Firestore index issue, using fallback query:', error);
      
      const fallbackQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(fallbackQuery);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Notification[];

      return notifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limitCount);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { 
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    
    try {
      const notifications = await this.getNotifications(userId, 100);
      const unreadNotifications = notifications.filter(n => !n.read);
      
      for (const notification of unreadNotifications) {
        await this.markAsRead(notification.id);
      }
      
      // Notifications marked as read
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    
    try {
      const notifications = await this.getNotifications(userId, 100);
      
      for (const notification of notifications) {
        await this.deleteNotification(notification.id);
      }
      
      // Notifications deleted
    } catch (error) {
      console.error('❌ Error deleting all notifications:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    if (!db) return 0;
    
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  // Check if a similar notification already exists
  async notificationExists(
    userId: string, 
    templateKey: string, 
    metadata?: Notification['metadata'],
    timeWindowHours: number = 24
  ): Promise<boolean> {
    try {
      const template = this.templates[templateKey];
      if (!template) return false;

      const notifications = await this.getNotifications(userId, 50);
      const cutoffTime = new Date(Date.now() - (timeWindowHours * 60 * 60 * 1000));
      
      return notifications.some(notification => {
        // Check if notification is recent
        if (notification.createdAt < cutoffTime) return false;
        
        // Check if it's the same type
        if (notification.title !== template.title.replace(/\{[^}]+\}/g, '.*')) {
          // For template matching, check if titles match pattern
          const titlePattern = template.title.replace(/\{[^}]+\}/g, '.*');
          const titleRegex = new RegExp(titlePattern);
          if (!titleRegex.test(notification.title)) return false;
        }
        
        // For task-related notifications, check specific task ID
        if (metadata?.taskId && notification.metadata?.taskId) {
          return notification.metadata.taskId === metadata.taskId;
        }
        
        // For workspace-related notifications, check workspace ID
        if (metadata?.workspaceId && notification.metadata?.workspaceId) {
          return notification.metadata.workspaceId === metadata.workspaceId;
        }
        
        // For system notifications (like welcome), check category
        if (template.category === 'system') {
          return notification.category === 'system' && 
                 notification.title === template.title;
        }
        
        return false;
      });
    } catch (error) {
      console.error('Error checking notification existence:', error);
      return false; // If we can't check, allow creation
    }
  }

  // Enhanced create notification with duplicate prevention
  async createNotificationSafe(
    userId: string, 
    templateKey: string, 
    replacements: Record<string, string> = {},
    metadata?: Notification['metadata'],
    actionUrl?: string,
    preventDuplicates: boolean = true,
    timeWindowHours: number = 24
  ): Promise<string | null> {
    // Check for duplicates if prevention is enabled
    if (preventDuplicates) {
      const exists = await this.notificationExists(userId, templateKey, metadata, timeWindowHours);
      if (exists) {
        // Duplicate notification prevented
        return null;
      }
    }
    
    return await this.createNotification(userId, templateKey, replacements, metadata, actionUrl);
  }

  // Utility methods for creating specific notifications
  async notifyTaskAssigned(
    assigneeId: string, 
    taskTitle: string, 
    assignerName: string,
    workspaceId: string,
    boardId: string,
    taskId: string
  ): Promise<void> {
    await this.createNotificationSafe(
      assigneeId,
      'taskAssigned',
      { taskTitle, assignerName },
      { taskId, workspaceId, boardId, assignerName },
      `/workspace/${workspaceId}/board/${boardId}`,
      true, // Prevent duplicates
      1 // Only prevent duplicates within 1 hour for task assignments
    );
  }

  async notifyWorkspaceCreated(
    userId: string,
    workspaceName: string,
    workspaceId: string
  ): Promise<void> {
    await this.createNotificationSafe(
      userId,
      'workspaceCreated',
      { workspaceName },
      { workspaceId },
      `/workspace/${workspaceId}`,
      true, // Prevent duplicates
      24 // Prevent duplicates for 24 hours
    );
  }

  async notifyWelcome(userId: string): Promise<void> {
    // Use createNotificationSafe with permanent duplicate prevention for welcome messages
    await this.createNotificationSafe(
      userId,
      'welcomeMessage',
      {},
      {},
      '/dashboard',
      true, // Prevent duplicates
      24 * 365 // Prevent welcome duplicates for 1 year (essentially permanent)
    );
  }

  // Add method to clean up old/duplicate notifications
  async cleanupDuplicateNotifications(userId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications(userId, 100);
      
      // List of repetitive/unwanted notification titles to remove completely
      const unwantedTitles = [
        'Task Reminder', // The repetitive "3 pending tasks" message
        'New Feature Available' // The repetitive feature announcement
      ];
      
      // First, remove all unwanted repetitive notifications
      const unwantedNotifications = notifications.filter(notification => 
        unwantedTitles.includes(notification.title) ||
        (notification.title === 'Task Reminder' && notification.message.includes('3 pending tasks')) ||
        (notification.title === 'New Feature Available' && notification.message.includes('Real-time collaboration'))
      );
      
      // Remove unwanted notifications
      for (const notification of unwantedNotifications) {
        await this.deleteNotification(notification.id);
      }
      
      // Then, group remaining notifications by title and find duplicates
      const remainingNotifications = notifications.filter(n => !unwantedNotifications.includes(n));
      const notificationGroups = remainingNotifications.reduce((groups, notification) => {
        const key = `${notification.title}_${notification.metadata?.taskId || notification.metadata?.workspaceId || 'system'}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(notification);
        return groups;
      }, {} as Record<string, typeof remainingNotifications>);

      // Delete older duplicates, keeping only the most recent one
      for (const [, group] of Object.entries(notificationGroups)) {
        if (group.length > 1) {
          // Sort by creation date (newest first) and keep only the first one
          const sorted = group.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          const toDelete = sorted.slice(1); // Remove all except the newest
          
          for (const notification of toDelete) {
            await this.deleteNotification(notification.id);
          }
        }
      }
      
      // Cleanup complete
    } catch (error) {
      console.error('Error cleaning up duplicate notifications:', error);
    }
  }
}

// Export singleton instance
export const enhancedNotificationService = new EnhancedNotificationService();

// Backward compatibility
export const notificationService = {
  async getNotifications(userId: string) {
    return await enhancedNotificationService.getNotifications(userId);
  },
  
  async markAsRead(notificationId: string) {
    return await enhancedNotificationService.markAsRead(notificationId);
  },
  
  async deleteNotification(notificationId: string) {
    return await enhancedNotificationService.deleteNotification(notificationId);
  },
  
  async createNotification(notification: Omit<Notification, 'id'>) {
    return await enhancedNotificationService.createNotification(
      notification.userId,
      'welcomeMessage',
      {},
      notification.metadata,
      notification.actionUrl
    );
  }
};