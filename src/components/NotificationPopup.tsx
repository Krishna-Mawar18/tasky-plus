'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Clock, Trash2, Bell, Filter } from 'lucide-react';
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

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onNotificationUpdate?: () => void;
}

export default function NotificationPopup({ isOpen, onClose, userId, onNotificationUpdate }: NotificationPopupProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    if (isOpen && userId) {
      const loadNotifications = async () => {
        try {
          setIsLoading(true);
          const userNotifications = await enhancedNotificationService.getNotifications(userId, 20);
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

  // Reset filter when notifications change
  useEffect(() => {
    if (notifications.length === 0) {
      setFilter('all');
    }
  }, [notifications]);

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await enhancedNotificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      onNotificationUpdate?.();
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
      onNotificationUpdate?.();
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-[90] animate-fadein"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="fixed top-20 right-4 w-96 max-h-[calc(100vh-6rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 z-[95] animate-slidein">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center shadow-lg">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono">Notifications</h2>
              <p className="text-xs text-gray-600 font-mono">
                {notifications.length === 0 
                  ? 'No notifications' 
                  : `${unreadCount} unread`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white rounded-lg transition-all duration-200 hover:scale-110"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: notifications.length - unreadCount }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as 'all' | 'unread' | 'read')}
              className={`flex-1 py-2 px-3 text-xs font-mono font-bold transition-all duration-200 ${
                filter === tab.key
                  ? 'text-gray-800 border-b-2 border-gray-600 bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              } ${notifications.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={notifications.length === 0}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
                <Bell className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-mono font-bold mb-1">
                {notifications.length === 0 
                  ? 'No notifications yet' 
                  : filter === 'all' 
                    ? 'No notifications' 
                    : `No ${filter} notifications`
                }
              </p>
              <p className="text-xs text-center">
                {notifications.length === 0 
                  ? 'We\'ll notify you when something important happens!' 
                  : 'You\'re all caught up!'
                }
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  style={{ animationDelay: `${index * 0.05}s` }}
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
          <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center justify-between text-xs text-gray-600 font-mono">
              <span>{filteredNotifications.length} of {notifications.length} notifications</span>
              <button
                onClick={() => {
                  // Mark all as read
                  filteredNotifications.forEach(n => {
                    if (!n.read) handleMarkAsRead(n.id);
                  });
                  onNotificationUpdate?.();
                }}
                className="text-gray-800 hover:text-gray-900 font-bold"
              >
                Mark all as read
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes slidein { 
          from { 
            opacity: 0; 
            transform: translateX(100%) translateY(-20px) scale(0.95); 
          } 
          to { 
            opacity: 1; 
            transform: translateX(0) translateY(0) scale(1); 
          } 
        }
        .animate-slidein { 
          animation: slidein 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        @keyframes fadein { 
          from { opacity: 0; transform: translateY(5px) scale(0.98); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        .animate-fadein { 
          animation: fadein 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
        }
      `}</style>
    </>
  );
} 