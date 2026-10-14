'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export interface MarkLauncherProps {
  /** Optional explicit context. When omitted it is derived from the path. */
  workspaceId?: string;
  boardId?: string;
  taskId?: string;
  className?: string;
}

/** Pull workspace/board ids out of a `/workspace/:id/board/:id` style path. */
function contextFromPath(pathname: string): { workspaceId?: string; boardId?: string } {
  const segments = pathname.split('/').filter(Boolean);
  const workspaceIndex = segments.indexOf('workspace');
  const workspaceId = workspaceIndex >= 0 ? segments[workspaceIndex + 1] : undefined;
  const boardIndex = segments.indexOf('board');
  const boardId = boardIndex >= 0 ? segments[boardIndex + 1] : undefined;
  return { workspaceId, boardId };
}

/**
 * Small, consistent entry point to Mark.
 *
 * Its only job is to navigate to the dedicated `/mark` page, carrying whatever
 * workspace/board context the current screen has. Mark itself is never rendered
 * as a panel or popover here — this is a link, not an embedded chat.
 *
 * Mounted once in the root layout; it hides itself on the landing page and on
 * the Mark page itself, and only appears for signed-in users.
 */
export default function MarkLauncher({ workspaceId, boardId, taskId, className }: MarkLauncherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;
  if (pathname === '/' || pathname.startsWith('/mark')) return null;

  const derived = contextFromPath(pathname);
  const resolvedWorkspaceId = workspaceId ?? derived.workspaceId;
  const resolvedBoardId = boardId ?? derived.boardId;

  const open = () => {
    const params = new URLSearchParams();
    if (resolvedWorkspaceId) params.set('workspaceId', resolvedWorkspaceId);
    if (resolvedBoardId) params.set('boardId', resolvedBoardId);
    if (taskId) params.set('taskId', taskId);
    const query = params.toString();
    router.push(query ? `/mark?${query}` : '/mark');
  };

  return (
    <button
      type="button"
      onClick={open}
      title="Ask Mark"
      aria-label="Open Mark"
      className={
        className ??
        'fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 font-mono text-sm font-bold text-gray-900 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl'
      }
    >
      <Image src="/mark.svg" alt="Mark Logo" width={40} height={40} className="bg-transparent transition-transform rounded-full duration-300 shadow-xl border-b border-black" />
      <span>Ask Mark</span>
    </button>
  );
}
