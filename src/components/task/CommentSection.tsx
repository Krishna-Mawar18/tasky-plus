'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import type { TaskComment } from '@/types';
import { canComment, canDeleteComment } from '@/lib/permissions';
import type { WorkspaceRole } from '@/types';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { ConfirmDialog } from './ConfirmDialog';
import { useTaskComments } from '@/hooks/useTaskComments';

interface CommentSectionProps {
  taskId: string;
  role: WorkspaceRole | null;
  currentUserId: string | null;
  currentUserName: string;
  currentUserPhotoURL: string | null;
}

export interface CommentSectionHandle {
  reload: () => void;
}

/**
 * The comment thread, inside the task modal.
 *
 * There is no comments page: comments belong to a task and are only reachable
 * from it. Ordering is oldest → newest with the newest at the bottom, which is
 * why pages are fetched newest-first and simply reversed for display.
 */
export function CommentSection({
  taskId,
  role,
  currentUserId,
  currentUserName,
  currentUserPhotoURL,
}: CommentSectionProps) {
  const {
    comments,
    loading,
    loadingMore,
    submitting,
    error,
    hasMore,
    addComment,
    editComment,
    deleteComment,
    loadMore,
    refresh,
  } = useTaskComments(taskId);

  const [pendingDelete, setPendingDelete] = useState<TaskComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Follow a posted comment down.
   *
   * The scroll is deliberately *not* done on first load: opening a task should
   * leave the reader at the top, looking at the description, rather than jumping
   * the modal down to the discussion. It only follows once the reader has
   * actually posted something.
   *
   * `submitting` flips true at the start of a post and false when it resolves, so
   * the flag is armed then and the scroll happens on the next render that also
   * has the new comment in the list.
   */
  const followNewest = useRef(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitting) followNewest.current = true;
  }, [submitting]);

  useEffect(() => {
    if (!followNewest.current || loading) return;
    followNewest.current = false;
    threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [comments.length, loading]);

  // A new task in the same modal has to reset the pending state.
  useEffect(() => {
    followNewest.current = false;
    setPendingDelete(null);
    setDeleteError(null);
  }, [taskId]);

  const handleSubmit = useCallback(
    (content: string) =>
      addComment({
        authorId: currentUserId ?? '',
        authorName: currentUserName,
        authorPhotoURL: currentUserPhotoURL,
        content,
      }),
    [addComment, currentUserId, currentUserName, currentUserPhotoURL],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteComment(pendingDelete.id);
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Could not delete this comment.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-3" aria-label="Comments">
      <h3 className="font-mono font-bold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        Comments
        {!loading && comments.length > 0 && (
          <span className="text-xs font-normal text-gray-500">
            {hasMore ? `${comments.length}+` : comments.length}
          </span>
        )}
      </h3>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center font-mono text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading comments...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-red-700 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Try again"
            aria-label="Retry loading comments"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && comments.length === 0 && (
        <div className="py-6 text-center border-2 border-dashed border-gray-200 rounded-lg">
          <MessageSquare className="mx-auto w-6 h-6 text-gray-300 mb-1" />
          <p className="font-mono text-xs text-gray-500">
            No comments yet. Start the conversation below.
          </p>
        </div>
      )}

      {/* Thread — oldest first, so the newest sits at the bottom. */}
      {comments.length > 0 && (
        <>
          <ul className="space-y-3">
            {[...comments]
              .sort((a, b) => {
                const left = a.createdAt?.getTime() ?? 0;
                const right = b.createdAt?.getTime() ?? 0;
                if (left !== right) return left - right;
                // A just-posted comment has no server timestamp yet; the document
                // id keeps it last rather than first.
                return a.id.localeCompare(b.id);
              })
              .map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isOwn={comment.authorId === currentUserId}
                  canDelete={canDeleteComment(role, comment.authorId, currentUserId)}
                  onSave={(commentId, content) => editComment(commentId, content)}
                  onOpenDeleteConfirm={setPendingDelete}
                />
              ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg font-mono text-xs font-bold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading older comments...
                </span>
              ) : (
                'Load more comments'
              )}
            </button>
          )}

          <div ref={threadEndRef} />
        </>
      )}

      {/* Composer — a viewer may comment, which is intentional. */}
      <CommentComposer
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={!canComment(role)}
        disabledReason="Your role does not allow commenting on this task."
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete comment"
        subtitle="This cannot be undone"
        tone="danger"
        confirmLabel="Delete comment"
        busyLabel="Deleting..."
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        <p className="text-sm font-mono text-gray-700 mb-3">
          Delete {pendingDelete?.authorName}&apos;s comment? It will be removed from the thread
          permanently.
        </p>
        {deleteError && (
          <p className="text-xs font-mono text-red-600" role="alert">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}