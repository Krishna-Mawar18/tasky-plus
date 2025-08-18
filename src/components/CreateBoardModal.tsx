'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Palette } from 'lucide-react';
import { Workspace } from '@/types';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; workspaceId: string; columns?: any[] }) => void;
  workspaces: Workspace[];
}

const boardTemplates = [
  {
    name: 'Basic Kanban',
    description: 'Simple To Do, In Progress, Done workflow',
    columns: [
      { id: 'todo', name: 'To Do', order: 1 },
      { id: 'in-progress', name: 'In Progress', order: 2 },
      { id: 'done', name: 'Done', order: 3 }
    ]
  },
  {
    name: 'Project Management',
    description: 'Comprehensive project tracking workflow',
    columns: [
      { id: 'backlog', name: 'Backlog', order: 1 },
      { id: 'planning', name: 'Planning', order: 2 },
      { id: 'in-progress', name: 'In Progress', order: 3 },
      { id: 'review', name: 'Review', order: 4 },
      { id: 'done', name: 'Done', order: 5 }
    ]
  },
  {
    name: 'Bug Tracking',
    description: 'Software bug tracking workflow',
    columns: [
      { id: 'new', name: 'New', order: 1 },
      { id: 'investigating', name: 'Investigating', order: 2 },
      { id: 'in-progress', name: 'In Progress', order: 3 },
      { id: 'testing', name: 'Testing', order: 4 },
      { id: 'resolved', name: 'Resolved', order: 5 }
    ]
  }
];

export default function CreateBoardModal({ isOpen, onClose, onSubmit, workspaces }: CreateBoardModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workspaceId: '',
    template: 'basic-kanban'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && workspaces.length > 0 && !formData.workspaceId) {
      setFormData(prev => ({ 
        ...prev, 
        workspaceId: workspaces[0].id,
        template: 'basic-kanban' // Set default template
      }));
    }
  }, [isOpen, workspaces, formData.workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.workspaceId) return;

    setIsSubmitting(true);
    try {
      const templateColumns = getTemplateColumns(formData.template);
      
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
        workspaceId: formData.workspaceId,
        columns: templateColumns
      });
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        workspaceId: workspaces.length > 0 ? workspaces[0].id : '',
        template: 'basic-kanban'
      });
      onClose();
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Failed to create board. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateChange = (template: string) => {
    setFormData(prev => ({ ...prev, template }));
  };

  const getTemplateColumns = (templateName: string) => {
    const template = boardTemplates.find(t => {
      const normalizedName = t.name.toLowerCase().replace(/\s+/g, '-');
      return normalizedName === templateName;
    });
    return template ? template.columns : boardTemplates[0].columns;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xl z-40 animate-fadein"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white backdrop-blur-md rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slidein border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white rounded-t-xl">
            <h2 className="text-2xl font-bold font-mono">Create New Board</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Workspace Selection */}
            <div>
              <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                Workspace *
              </label>
              <select
                value={formData.workspaceId}
                onChange={(e) => setFormData(prev => ({ ...prev, workspaceId: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 hover:border-gray-400"
                required
              >
                <option value="">Select a workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {workspaces.length === 0 && (
                <p className="text-sm text-red-500 mt-1 animate-pulse">
                  You need to create a workspace first!
                </p>
              )}
            </div>

            {/* Board Name */}
            <div>
              <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                Board Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter board name"
                className="w-full p-3 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 hover:border-gray-400"
                required
              />
            </div>

            {/* Board Description */}
            <div>
              <label className="block text-sm font-bold font-mono text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your board (optional)"
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none transition-all duration-200 hover:border-gray-400"
              />
            </div>

            {/* Board Template */}
            <div>
              <label className="block text-sm font-bold font-mono text-gray-700 mb-3">
                Choose Template
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {boardTemplates.map((template, index) => {
                  const templateId = template.name.toLowerCase().replace(/\s+/g, '-');
                  const isSelected = formData.template === templateId;
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleTemplateChange(templateId)}
                      className={`p-4 border-2 rounded-lg text-left transition-all duration-300 hover:scale-105 ${
                        isSelected
                          ? 'border-gray-400 bg-gray-50 shadow-lg ring-2 ring-gray-200'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-mono font-bold text-sm">{template.name}</h3>
                        {isSelected && (
                          <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                      <div className="flex items-center space-x-1">
                        {template.columns.map((column, colIndex) => (
                          <div
                            key={colIndex}
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-gray-500' : 'bg-gray-300'
                            }`}
                            title={column.name}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2 font-mono">
                Selected: <span className="font-bold">{formData.template}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 font-mono font-bold hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.name.trim() || !formData.workspaceId || workspaces.length === 0}
                className="px-6 py-2 bg-black text-white font-mono font-bold rounded-lg hover:bg-white hover:text-black hover:border-black border-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Board</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        .animate-fadein { 
          animation: fadein 0.3s ease-out; 
        }
        @keyframes slidein { 
          from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
          } 
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          } 
        }
        .animate-slidein { 
          animation: slidein 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
        }
      `}</style>
    </>
  );
}