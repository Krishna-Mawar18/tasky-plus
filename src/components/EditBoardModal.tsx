'use client';

import { useState, useEffect } from 'react';
import { X, Edit } from 'lucide-react';
import { Board } from '@/types';

interface EditBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Board | null;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
}

export default function EditBoardModal({ isOpen, onClose, board, onSubmit }: EditBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when board changes
  useEffect(() => {
    if (board) {
      setName(board.name);
      setDescription(board.description || '');
    }
  }, [board]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !board) return;

    setIsSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
      };
      await onSubmit(data);
      handleClose();
    } catch (error) {
      console.error('Error updating board:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (board) {
      setName(board.name);
      setDescription(board.description || '');
    }
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen || !board) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono">Edit Board</h2>
              <p className="text-sm text-gray-600 font-mono">Update board details</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Board Name */}
          <div>
            <label htmlFor="boardName" className="block text-sm font-mono font-bold text-gray-700 mb-2">
              Board Name
            </label>
            <input
              type="text"
              id="boardName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono"
              placeholder="Enter board name"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Board Description */}
          <div>
            <label htmlFor="boardDescription" className="block text-sm font-mono font-bold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="boardDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 font-mono resize-none"
              placeholder="Enter board description"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  <span>Update Board</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-red-100 hover:border-red-300 hover:text-red-500 border-2 border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
