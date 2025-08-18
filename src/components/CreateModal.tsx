'use client';

import { useState } from 'react';
import { X, Plus, Palette, Users } from 'lucide-react';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'workspace' | 'board';
  onSubmit: (data: any) => void;
  workspaceId?: string;
}

const workspaceColors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
  'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'
];

export default function CreateModal({ isOpen, onClose, type, onSubmit, workspaceId }: CreateModalProps) {
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
        ...(type === 'workspace' && { color: selectedColor }),
        ...(type === 'board' && { workspaceId }),
      };
      await onSubmit(data);
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fadein">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono">
                Create {type === 'workspace' ? 'Workspace' : 'Board'}
              </h2>
              <p className="text-sm text-gray-600 font-mono">
                {type === 'workspace' ? 'Organize your projects' : 'Manage your tasks'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
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
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none"
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
                    className={`w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                      selectedColor === color 
                        ? 'border-black scale-110 shadow-lg' 
                        : 'border-gray-300 hover:border-gray-400'
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
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-mono font-bold text-sm hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create {type === 'workspace' ? 'Workspace' : 'Board'}</span>
                </>
              )}
            </button>
          </div>
        </form>
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