'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { workspaceService, boardService } from '@/lib/services';
import { Workspace, Board } from '@/types';
import { Plus, ArrowLeft, Users, Settings } from 'lucide-react';

export default function WorkspacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
      return;
    }

    if (user && workspaceId) {
      loadWorkspaceData();
    }
  }, [user, loading, workspaceId]);

  const loadWorkspaceData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load workspace details
      const workspaceData = await workspaceService.getWorkspace(workspaceId);
      setWorkspace(workspaceData);

      // Load boards for this workspace
      const boardsData = await boardService.getBoards(workspaceId);
      setBoards(boardsData);
    } catch (error) {
      console.error('Error loading workspace:', error);
      setError('Failed to load workspace. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBoard = () => {
    // TODO: Implement board creation modal
    console.log('Create board clicked');
  };

  const handleBoardClick = (boardId: string) => {
    router.push(`/workspace/${workspaceId}/board/${boardId}`);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-mono mb-4">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-black text-white px-4 py-2 rounded-lg font-mono"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold font-mono">
                  {workspace?.name || 'Workspace'}
                </h1>
                <p className="text-gray-600 text-sm font-mono">
                  {workspace?.description || 'No description'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Users className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Boards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-mono">Boards</h2>
            <button
              onClick={handleCreateBoard}
              className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Board</span>
            </button>
          </div>

          {boards.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold font-mono mb-2">No boards yet</h3>
              <p className="text-gray-600 font-mono mb-4">Create your first board to get started</p>
              <button
                onClick={handleCreateBoard}
                className="bg-black text-white px-6 py-3 rounded-lg font-mono font-bold hover:bg-gray-800 transition-colors"
              >
                Create Board
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => handleBoardClick(board.id)}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer"
                >
                  <h3 className="text-lg font-bold font-mono mb-2">{board.name}</h3>
                  <p className="text-gray-600 font-mono text-sm mb-4">
                    {board.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
                    <span>{board.columns?.length || 0} columns</span>
                    <span>Updated recently</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
