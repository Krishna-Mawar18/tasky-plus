'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskAttachment } from '@/types';
import { attachmentService, describeAttachmentError } from '@/lib/attachmentService';
import { resolveAttachmentStorage } from '@/lib/storageService';

/**
 * Attachment metadata state for one task.
 *
 * The list is metadata only — this hook never sees a file body beyond the one
 * being uploaded, and it never mints a URL itself. URLs come from the storage
 * service on demand, which is why the preview and download actions below are
 * asynchronous and can report that storage is not configured.
 */
export function useTaskAttachments(taskId: string | null) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = useRef(true);

  /**
   * Whether an object store is reachable at all.
   *
   * Read once per mount rather than per render: it changes only when the storage
   * provider is registered, which is a deployment event, not a user action.
   */
  const storageAvailable = useRef(resolveAttachmentStorage().isAvailable());

  const load = useCallback(async () => {
    if (!taskId) {
      setAttachments([]);
      return;
    }
    await attachmentService.getAttachments(taskId).then((next) => {
      if (active.current) setAttachments(next);
    });
  }, [taskId]);

  useEffect(() => {
    active.current = true;
    setError(null);

    if (!taskId) {
      setAttachments([]);
      return () => {
        active.current = false;
      };
    }

    setLoading(true);
    void load()
      .catch((cause) => {
        if (active.current) setError(describeAttachmentError(cause));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });

    return () => {
      active.current = false;
    };
  }, [taskId, load]);

  const upload = useCallback(
    async (input: { workspaceId: string; boardId: string; uploadedBy: string; file: File }) => {
      if (!taskId) return null;
      setUploading(true);
      setError(null);
      try {
        const created = await attachmentService.attachFile({ taskId, ...input });
        await load();
        return created;
      } catch (cause) {
        // Surfaced in place rather than only as a toast, because "storage is
        // not connected yet" is a standing condition a person needs to read, not
        // a transient failure that should disappear.
        setError(describeAttachmentError(cause));
        throw cause;
      } finally {
        if (active.current) setUploading(false);
      }
    },
    [taskId, load],
  );

  const remove = useCallback(
    async (attachment: TaskAttachment) => {
      if (!taskId) return;
      setDeletingId(attachment.id);
      setError(null);
      try {
        await attachmentService.deleteAttachment({
          taskId,
          attachmentId: attachment.id,
          s3Key: attachment.s3Key,
        });
        await load();
      } catch (cause) {
        setError(describeAttachmentError(cause));
        throw cause;
      } finally {
        if (active.current) setDeletingId(null);
      }
    },
    [taskId, load],
  );

  return {
    attachments,
    loading,
    uploading,
    deletingId,
    error,
    storageAvailable: storageAvailable.current,
    upload,
    remove,
    clearError: () => setError(null),
  };
}