'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Link2, Loader2, Plus } from 'lucide-react';
import type { TaskLink, WorkspaceRole } from '@/types';
import { canDeleteLink, canEditLink, canManageLinks } from '@/lib/permissions';
import { useTaskLinks } from '@/hooks/useTaskLinks';
import { LinkDialog } from './LinkDialog';
import { LinkRow } from './LinkRow';
import { ConfirmDialog } from './ConfirmDialog';

interface LinkListProps {
  taskId: string;
  role: WorkspaceRole | null;
  currentUserId: string | null;
  currentUserName: string;
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; link: TaskLink }
  | null;

/**
 * The links area, rendered inside the task's attachment section.
 *
 * Links are metadata only, so this list is deliberately independent of
 * `storageAvailable` — a link can be added, opened, copied, edited and deleted
 * even while file storage is not connected.
 */
export function LinkList({ taskId, role, currentUserId, currentUserName }: LinkListProps) {
  const { links, loading, deletingId, error, add, update, remove, clearError } =
    useTaskLinks(taskId);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskLink | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mayManage = canManageLinks(role);

  // A different task in the same modal must not leave a dialog or confirmation
  // pointing at the previous task's link.
  useEffect(() => {
    setDialog(null);
    setPendingDelete(null);
    setDeleteError(null);
  }, [taskId]);

  const openCreate = () => {
    clearError();
    setDialog({ mode: 'create' });
  };

  const openEdit = (link: TaskLink) => {
    clearError();
    setDialog({ mode: 'edit', link });
  };

  const handleCreate = async (values: { title: string; url: string }) => {
    await add({
      createdBy: currentUserId ?? '',
      createdByName: currentUserName || 'Unknown user',
      ...values,
    });
    setDialog(null);
  };

  const handleEdit = async (values: { title: string; url: string }) => {
    if (dialog?.mode !== 'edit') return;
    await update(dialog.link.id, values);
    setDialog(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(pendingDelete);
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Could not delete this link.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-mono font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-500" />
          Links
          {!loading && links.length > 0 && (
            <span className="text-xs font-normal text-gray-500">{links.length}</span>
          )}
        </h4>

        {mayManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-800 hover:bg-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Link
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3 justify-center font-mono text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading links...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="font-mono text-xs text-red-700 flex-1" role="alert">
            {error}
          </p>
        </div>
      )}

      {!loading && links.length === 0 && (
        <p className="py-3 text-center border-2 border-dashed border-gray-200 rounded-lg font-mono text-xs text-gray-500">
          No links yet.
          {!mayManage && ' Links added by a manager or owner appear here.'}
        </p>
      )}

      {links.length > 0 && (
        <ul className="space-y-2" aria-label="Task links">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              currentUserId={currentUserId}
              canEdit={canEditLink(role, link.createdBy, currentUserId)}
              canDelete={canDeleteLink(role, link.createdBy, currentUserId)}
              deleting={deletingId === link.id}
              onRequestEditAction={openEdit}
              onRequestDeleteAction={(target) => {
                clearError();
                setDeleteError(null);
                setPendingDelete(target);
              }}
            />
          ))}
        </ul>
      )}

      <LinkDialog
        isOpen={dialog !== null}
        mode={dialog?.mode === 'edit' ? 'edit' : 'create'}
        initialTitle={dialog?.mode === 'edit' ? dialog.link.title : ''}
        initialUrl={dialog?.mode === 'edit' ? dialog.link.url : ''}
        onCancelAction={() => setDialog(null)}
        onSubmitAction={dialog?.mode === 'edit' ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete link"
        subtitle="This removes the reference from the task"
        tone="danger"
        confirmLabel="Delete link"
        busyLabel="Deleting..."
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        <p className="text-sm font-mono text-gray-700 mb-3">
          Delete &quot;{pendingDelete?.title}&quot; from this task? The task itself is not affected.
        </p>
        {deleteError && (
          <p className="text-xs font-mono text-red-600" role="alert">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
