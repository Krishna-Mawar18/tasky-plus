'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskLink } from '@/types';
import { describeLinkError, linkService } from '@/lib/linkService';

/**
 * Link state for one task.
 *
 * Mirrors `useTaskAttachments`: the list is loaded per task, mutations refresh
 * it, and a request that resolves after the task changed or the modal closed is
 * discarded rather than written into the wrong task's state.
 *
 * Link availability is deliberately independent of file storage. A link is
 * metadata only — nothing is uploaded — so this hook never consults
 * `resolveAttachmentStorage` and works even while S3 is absent.
 */
export function useTaskLinks(taskId: string | null) {
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Set false on unmount or task change, so no late write lands. */
  const active = useRef(true);

  const load = useCallback(async () => {
    if (!taskId) {
      setLinks([]);
      return;
    }
    const next = await linkService.getLinks(taskId);
    if (active.current) setLinks(next);
  }, [taskId]);

  useEffect(() => {
    active.current = true;
    setError(null);

    if (!taskId) {
      setLinks([]);
      return () => {
        active.current = false;
      };
    }

    setLoading(true);
    void load()
      .catch((cause) => {
        if (active.current) setError(describeLinkError(cause));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });

    return () => {
      active.current = false;
    };
  }, [taskId, load]);

  const add = useCallback(
    async (input: { createdBy: string; createdByName: string; title: string; url: string }) => {
      if (!taskId) return null;
      setAdding(true);
      setError(null);
      try {
        const createdId = await linkService.addLink({ taskId, ...input });
        await load();
        return createdId;
      } catch (cause) {
        // Surfaced in place as well as rethrown, so a dialog can show the
        // reason next to the field and the list can stay consistent.
        setError(describeLinkError(cause));
        throw cause;
      } finally {
        if (active.current) setAdding(false);
      }
    },
    [taskId, load],
  );

  const update = useCallback(
    async (linkId: string, input: { title: string; url: string }) => {
      if (!taskId) return;
      setUpdatingId(linkId);
      setError(null);
      try {
        await linkService.updateLink({ taskId, linkId, ...input });
        await load();
      } catch (cause) {
        setError(describeLinkError(cause));
        throw cause;
      } finally {
        if (active.current) setUpdatingId(null);
      }
    },
    [taskId, load],
  );

  const remove = useCallback(
    async (link: TaskLink) => {
      if (!taskId) return;
      setDeletingId(link.id);
      setError(null);
      try {
        await linkService.deleteLink({ taskId, linkId: link.id });
        await load();
      } catch (cause) {
        setError(describeLinkError(cause));
        throw cause;
      } finally {
        if (active.current) setDeletingId(null);
      }
    },
    [taskId, load],
  );

  return {
    links,
    loading,
    adding,
    updatingId,
    deletingId,
    error,
    add,
    update,
    remove,
    clearError: () => setError(null),
  };
}
