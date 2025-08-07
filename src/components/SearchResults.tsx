'use client';

import { Workspace, Board, Task } from '@/types';
import { Building2, Layout, CheckSquare, ArrowRight, Search, X } from 'lucide-react';

interface SearchResultsProps {
  results: {
    workspaces: Workspace[];
  };
  query: string;
  onClose: () => void;
  onNavigate: (type: 'workspace', id: string) => void;
}

export default function SearchResults({ results, query, onClose, onNavigate }: SearchResultsProps) {
  const totalResults = results.workspaces.length;

  if (totalResults === 0) {
    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mt-2 p-6 z-[100] animate-fadein">
        <div className="flex items-center justify-center space-x-3 text-gray-500">
          <Search className="w-5 h-5 animate-pulse" />
          <p className="font-mono text-sm">No workspaces found for "{query}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mt-2 max-h-96 overflow-y-auto z-[100] animate-fadein backdrop-blur-sm">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 p-4 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-mono font-bold text-gray-700">
              {totalResults} workspace{totalResults !== 1 ? 's' : ''} found for "{query}"
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="p-2">
        {/* Workspaces */}
        {results.workspaces.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold font-mono text-gray-500 uppercase tracking-wide mb-3 px-2 flex items-center space-x-2">
              <Building2 className="w-3 h-3" />
              <span>Workspaces ({results.workspaces.length})</span>
            </h3>
            <div className="space-y-1">
              {results.workspaces.map((workspace, index) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    onNavigate('workspace', workspace.id);
                    onClose();
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-blue-50 hover:scale-[1.02] rounded-lg transition-all duration-200 text-left group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className={`w-3 h-3 rounded-full ${workspace.color} group-hover:scale-125 transition-transform duration-200`}></div>
                  <Building2 className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm truncate group-hover:text-blue-600 transition-colors duration-200">
                      {workspace.name}
                    </p>
                    {workspace.description && (
                      <p className="text-xs text-gray-500 truncate group-hover:text-gray-600 transition-colors duration-200">{workspace.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { 
          from { opacity: 0; transform: translateY(-10px) scale(0.95); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        .animate-fadein { animation: fadein 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
    </div>
  );
}
