'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, Info, Clock, Trash2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

interface NotificationCardProps {
  notification: Notification;
  onMarkAsReadAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
}

export default function NotificationCard({ notification, onMarkAsReadAction, onDeleteAction }: NotificationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleCardClick = () => {
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      // Mark as read when navigating
      if (!notification.read) {
        onMarkAsReadAction(notification.id);
      }
    }
  };

  return (
    <div
      className={`relative p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group ${
        notification.read 
          ? 'bg-gray-50 border-gray-200' 
          : 'bg-white border-gray-300 shadow-sm'
      } ${notification.actionUrl ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 left-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className={`p-1.5 rounded-lg ${getNotificationColor(notification.type)} transition-all duration-200 group-hover:scale-110`}>
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-mono font-bold text-sm truncate group-hover:text-blue-600 transition-colors duration-200">
              {notification.title}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(notification.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`flex items-center space-x-1 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          {notification.actionUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(notification.actionUrl!);
                if (!notification.read) {
                  onMarkAsReadAction(notification.id);
                }
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110"
              title="Go to"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsReadAction(notification.id);
              }}
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110"
              title="Mark as read"
            >
              <CheckCircle className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteAction(notification.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
            title="Delete notification"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Message */}
      <p className="text-sm text-gray-600 font-mono leading-relaxed group-hover:text-gray-700 transition-colors duration-200">
        {notification.message}
      </p>

      {/* Status and category badges */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-mono font-bold transition-all duration-200 ${
            notification.category === 'task' ? 'bg-green-100 text-green-700' :
            notification.category === 'workspace' ? 'bg-purple-100 text-purple-700' :
            notification.category === 'reminder' ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {notification.category}
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-mono font-bold transition-all duration-200 ${
            notification.read 
              ? 'bg-gray-100 text-gray-600' 
              : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
          }`}>
            {notification.read ? 'Read' : 'Unread'}
          </span>
        </div>
        {notification.actionUrl && (
          <div className="text-xs text-gray-400 font-mono">
            Click to navigate
          </div>
        )}
      </div>
    </div>
  );
} 