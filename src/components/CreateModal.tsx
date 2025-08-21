'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface CreateModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  type: 'workspace' | 'board';
  onSubmitAction: (data: { name: string; description: string; color: string }) => void;
  workspaceId?: string;
}

const workspaceColors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
  'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'
];

export default function CreateModal({ isOpen, onCloseAction, type, onSubmitAction, workspaceId }: CreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(workspaceColors[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        color: type === 'workspace' ? selectedColor : 'bg-blue-500',
        ...(type === 'board' && { workspaceId }),
      };
      await onSubmitAction(data);
      handleClose();
    } catch (error) {
      console.error('Error creating', type, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedColor(workspaceColors[0]);
    setIsSubmitting(false);
    onCloseAction();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/20">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm animate-fadein border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/60">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-mono text-gray-900">
                Create {type === 'workspace' ? 'Workspace' : 'Board'}
              </h2>
              <p className="text-sm text-gray-600 font-mono">
                {type === 'workspace' ? 'Organize your projects' : 'Manage your tasks'}
              </p>
            </div>
          </div>
        
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
              {type === 'workspace' ? 'Workspace' : 'Board'} Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${type} name...`}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all duration-200 bg-white/80 backdrop-blur-sm"
              required
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe your ${type}...`}
              rows={2}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all duration-200 bg-white/80 backdrop-blur-sm resize-none"
            />
          </div>

          {/* Color Picker (only for workspaces) */}
          {type === 'workspace' && (
            <div>
              <label className="block text-sm font-bold font-mono text-gray-700 mb-3">
                Choose Color
              </label>
              <div className="grid grid-cols-4 gap-3">
                {workspaceColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-12 h-12 rounded-xl border-3 transition-all duration-300 hover:scale-105 ${
                      selectedColor === color 
                        ? 'border-white scale-110 shadow-xl ring-1 ring-black/20' 
                        : 'border-white/50 hover:border-white shadow-lg'
                    } ${color}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-mono font-bold text-sm hover:bg-red-200 hover:border-red-500 hover:text-red-500 transition-all duration-200 hover:scale-105"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 px-5 py-2 bg-black text-white rounded-xl font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="whitespace-nowrap">Create {type === 'workspace' ? 'Workspace' : 'Board'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { 
            opacity: 0; 
            transform: scale(0.9) translateY(-20px); 
          } 
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          } 
        }
        .animate-fadein { 
          animation: fadein 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .border-3 {
          border-width: 3px;
        }
      `}</style>
    </div>
  );
} 