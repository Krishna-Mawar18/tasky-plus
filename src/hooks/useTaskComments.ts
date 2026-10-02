'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { TaskComment } from '@/types';
import {
  COMMENT_PAGE_SIZE,
  commentService,
  describeCommentError,
  fetchCommentPage,
} from '@/lib/commentService';

/**
 * Paged comment state for one task.
 *
 * Pages are read oldest-to-newest for display but fetched newest-first, so the
 * newest comment is always in the first page and stays at the bottom of the
 * list without any client-side reordering trickery.
 *
 * Every load is a real Firestore query with a `limit`; older pages continue from
 * a `startAfter` cursor. Nothing is fetched in full and sliced.
 */
export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  /** How many pages are currently on screen. Drives the "Load more" button. */
  const [pageCount, setPageCount] = useState(0);
  /** Suppresses a state write after the task changes or the modal closes. */
  const active = useRef(true);

  /**
   * Fetch the newest `targetPages` pages and replace the list.
   *
   * Re-reading from the start is what lets a comment be added, edited or deleted
   * without losing pages the reader had already opened: the same number of pages
   * is requested again and the list is swapped wholesale.
   */
  const loadThrough = useCallback(
    async (targetPages: number) => {
      if (!taskId) {
        setComments([]);
        setHasMore(false);
        setPageCount(0);
        return;
      }

      const collected: TaskComment[] = [];
      // Index i is the cursor to start page i + 1 from; page 1 starts at null.
      const cursors: (QueryDocumentSnapshot | null)[] = [null];
      let more = false;
      let pages = 0;

      for (let page = 0; page < targetPages; page++) {
        const result = await fetchCommentPage(taskId, {
          cursor: cursors[page],
          limit: COMMENT_PAGE_SIZE,
        });
        collected.push(...result.comments);
        cursors[page + 1] = result.cursor;
        pages += 1;
        more = result.hasMore;
        // A short page means the beginning of the discussion was reached, so
        // asking for another page would just repeat this one.
        if (!result.hasMore) break;
      }

      if (!active.current) return;
      setComments(collected);
      setHasMore(more);
      setPageCount(pages);
    },
    [taskId],
  );

  useEffect(() => {
    active.current = true;
    setError(null);

    if (!taskId) {
      setComments([]);
      setHasMore(false);
      setPageCount(0);
      return () => {
        active.current = false;
      };
    }

    setLoading(true);
    void loadThrough(1)
      .catch((cause) => {
        if (active.current) setError(describeCommentError(cause));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });

    return () => {
      active.current = false;
    };
  }, [taskId, loadThrough]);

  /** Re-read exactly as many pages are on screen right now. */
  const refresh = useCallback(async () => {
    try {
      await loadThrough(Math.max(1, pageCount));
      setError(null);
    } catch (cause) {
      setError(describeCommentError(cause));
    }
  }, [loadThrough, pageCount]);

  const loadMore = useCallback(async () => {
    if (!taskId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await loadThrough(pageCount + 1);
      setError(null);
    } catch (cause) {
      setError(describeCommentError(cause));
    } finally {
      setLoadingMore(false);
    }
  }, [taskId, loadingMore, hasMore, pageCount, loadThrough]);

  const addComment = useCallback(
    async (input: { authorId: string; authorName: string; authorPhotoURL: string | null; content: string }) => {
      if (!taskId) return;
      setSubmitting(true);
      try {
        await commentService.addComment({ taskId, ...input });
        await refresh();
      } finally {
        if (active.current) setSubmitting(false);
      }
    },
    [taskId, refresh],
  );

  const editComment = useCallback(
    async (commentId: string, content: string) => {
      if (!taskId) return;
      await commentService.updateComment({ taskId, commentId, content });
      await refresh();
    },
    [taskId, refresh],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!taskId) return;
      await commentService.deleteComment({ taskId, commentId });
      // Removing a comment can leave the final page short, so the page count is
      // allowed to shrink here rather than leaving an empty "Load more".
      await refresh();
    },
    [taskId, refresh],
  );

  return {
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
    clearError: () => setError(null),
  };
}