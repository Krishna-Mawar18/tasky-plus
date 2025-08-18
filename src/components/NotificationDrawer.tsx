'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle, AlertCircle, Info, Clock, Bell, Filter } from 'lucide-react';
import { enhancedNotificationService } from '@/lib/notificationService';
import NotificationCard from './NotificationCard';

interface Notification {
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
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function NotificationDrawer({ isOpen, onClose, userId }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    if (isOpen && userId) {
      const loadNotifications = async () => {
        try {
          setIsLoading(true);
          const userNotifications = await enhancedNotificationService.getNotifications(userId, 50);
          setNotifications(userNotifications as Notification[]);
        } catch (error) {
          console.error('Error loading notifications:', error);
          setNotifications([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadNotifications();
    }
  }, [isOpen, userId]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await enhancedNotificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await enhancedNotificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div className={`fixed top-4 right-4 bottom-4 w-96 bg-white rounded-2xl shadow-2xl transform transition-all duration-300 ease-in-out z-50 border border-gray-200 ${
        isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono">Notifications</h2>
              <p className="text-sm text-gray-600 font-mono">
                {unreadCount} unread
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl transition-all duration-200 hover:shadow-md border border-gray-200 hover:border-gray-300"
          >
            <X className="w-5 h-5 text-gray-600 hover:text-gray-900" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: notifications.length - unreadCount }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as 'all' | 'unread' | 'read')}
              className={`flex-1 py-3 px-4 text-sm font-mono font-bold transition-colors ${
                filter === tab.key
                  ? 'text-gray-800 border-b-2 border-gray-600 bg-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-lg font-mono font-bold mb-2">
                {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
              </p>
              <p className="text-sm text-center">You're all caught up!</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  className="animate-fadein"
                >
                  <NotificationCard
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDeleteNotification}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center justify-between text-sm text-gray-600 font-mono">
              <span>{filteredNotifications.length} of {notifications.length} notifications</span>
              <button
                onClick={() => {
                  // Mark all as read
                  filteredNotifications.forEach(n => {
                    if (!n.read) handleMarkAsRead(n.id);
                  });
                }}
                className="text-gray-600 hover:text-gray-800 font-bold"
              >
                Mark all as read
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { opacity: 0; transform: translateY(10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fadein { animation: fadein 0.3s ease-out forwards; }
      `}</style>
    </>
  );
}