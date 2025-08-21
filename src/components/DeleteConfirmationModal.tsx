'use client';

import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Workspace } from '@/types';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  workspace, 
  onConfirm, 
  isDeleting 
}: DeleteConfirmationModalProps) {
  if (!isOpen || !workspace) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fadein">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono text-red-600">Delete Workspace</h2>
              <p className="text-sm text-gray-600 font-mono">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Warning Message */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold font-mono text-gray-800 mb-2">
              Are you sure you want to delete "{workspace.name}"?
            </h3>
            <p className="text-sm text-gray-600 font-mono">
              This will permanently delete the workspace and all its boards and tasks. 
              This action cannot be undone.
            </p>
          </div>

          {/* Workspace Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className={`w-4 h-4 rounded-full ${workspace.color}`}></div>
              <h4 className="font-mono font-bold text-gray-800">{workspace.name}</h4>
            </div>
            {workspace.description && (
              <p className="text-sm text-gray-600 font-mono mb-2">{workspace.description}</p>
            )}
            <p className="text-xs text-gray-500 font-mono">{workspace.members.length} members</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-mono font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Workspace</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { opacity: 0; transform: scale(0.95) translateY(-10px); } 
          to { opacity: 1; transform: scale(1) translateY(0); } 
        }
        .animate-fadein { animation: fadein 0.2s ease-out; }
      `}</style>
    </div>
  );
} 