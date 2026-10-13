'use client';

import { useState } from 'react';
import { AlertTriangle, HardDriveDownload, Loader2, Paperclip } from 'lucide-react';
import type { TaskAttachment } from '@/types';
import { canDeleteAttachment, canUploadAttachments } from '@/lib/permissions';
import type { WorkspaceRole } from '@/types';
import { attachmentService } from '@/lib/attachmentService';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import { formatAllowedExtensions, MAX_ATTACHMENT_BYTES, formatBytes } from '@/lib/fileValidation';
import { AttachmentDropzone } from './AttachmentDropzone';
import { AttachmentRow } from './AttachmentRow';
import { LinkList } from './LinkList';
import { ConfirmDialog } from './ConfirmDialog';

interface AttachmentSectionProps {
  taskId: string;
  workspaceId: string;
  boardId: string;
  role: WorkspaceRole | null;
  currentUserId: string | null;
  currentUserName: string;
}

/**
 * The attachment area inside the task modal.
 *
 * ## Storage is not connected yet
 *
 * There is no object store in this phase, so an upload attempt is refused by the
 * storage service and this section says so plainly instead of accepting the file
 * and pretending it was stored. The list, the validation and the metadata schema
 * are all live; only the bytes have nowhere to go. That is the whole gap Phase 2
 * closes.
 */
export function AttachmentSection({
  taskId,
  workspaceId,
  boardId,
  role,
  currentUserId,
  currentUserName,
}: AttachmentSectionProps) {
  const { attachments, loading, uploading, deletingId, error, storageAvailable, upload, remove } =
    useTaskAttachments(taskId);

  const [pendingDelete, setPendingDelete] = useState<TaskAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mayUpload = canUploadAttachments(role);

  const handleFiles = async (files: File[]) => {
    const [file] = files;
    if (!file) return;
    try {
      await upload({
        workspaceId,
        boardId,
        uploadedBy: currentUserId ?? '',
        file,
      });
    } catch {
      // The hook has already placed the reason in `error`; the row below renders
      // it, so swallowing here keeps this handler to one job.
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(pendingDelete);
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Could not delete this attachment.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-3" aria-label="Attachments">
      <h3 className="font-mono font-bold text-gray-900 flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-gray-500" />
        Attachments
        {!loading && attachments.length > 0 && (
          <span className="text-xs font-normal text-gray-500">{attachments.length}</span>
        )}
      </h3>

      {/*
        Shown to everyone, including viewers who cannot upload. Storage being
        absent is a property of the deployment, not of the person's role, and a
        viewer needs to know why a download button will not work either.
      */}
      {!storageAvailable && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <HardDriveDownload className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs font-bold text-amber-900">
              File storage is not connected yet
            </p>
            <p className="font-mono text-[11px] text-amber-800 mt-1 leading-relaxed">
              Attachment metadata, validation and permissions are in place, but object storage
              (S3) is not configured, so no file can be uploaded, previewed or downloaded yet.
              Nothing is stored in Firestore in the meantime.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4 justify-center font-mono text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading attachments...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && attachments.length === 0 && mayUpload && (
        <p className="py-3 text-center border-2 border-dashed border-gray-200 rounded-lg font-mono text-xs text-gray-500">
          No attachments yet.
        </p>
      )}

      {/* List */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              currentUserId={currentUserId}
              canDelete={canDeleteAttachment(role, attachment.uploadedBy, currentUserId)}
              deleting={deletingId === attachment.id}
              resolvePreviewUrl={(target) => attachmentService.getPreviewUrl(target)}
              onRequestDelete={(target) => {
                setDeleteError(null);
                setPendingDelete(target);
              }}
            />
          ))}
        </ul>
      )}

      {/* Error from an upload or delete attempt */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-mono text-xs text-red-700">{error}</p>
            {storageAvailable && (
              <p className="font-mono text-[11px] text-red-600 mt-1">
                Accepted: {formatAllowedExtensions()}, up to {formatBytes(MAX_ATTACHMENT_BYTES)}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload controls */}
      {!mayUpload ? (
        <p className="font-mono text-[11px] text-gray-500">
          Your role can read and download attachments but cannot add or remove them.
        </p>
      ) : storageAvailable ? (
        <AttachmentDropzone onFiles={(files) => void handleFiles(files)} uploading={uploading} />
      ) : (
        // The dropzone is withheld rather than offered and then refused: an upload
        // cannot succeed until a provider is registered, and the banner above
        // already says why. Showing a control that always fails would be noise.
        <p className="font-mono text-[11px] text-gray-400 border-2 border-dashed border-gray-200 rounded-lg px-3 py-2">
          Uploads are disabled until file storage is connected.
        </p>
      )}

      {/*
        Links live in the same section as files but are a separate concern:
        nothing is uploaded, so they are available whatever the storage status.
        The divider keeps the two kinds of attachment visually distinct.
      */}
      <div className="border-t border-gray-200 pt-3">
        <LinkList
          taskId={taskId}
          role={role}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete attachment"
        subtitle="Metadata and file are removed"
        tone="danger"
        confirmLabel="Delete attachment"
        busyLabel="Deleting..."
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        <p className="text-sm font-mono text-gray-700 mb-3">
          Delete &quot;{pendingDelete?.name}&quot; from this task? The metadata is removed
          immediately, and the stored file is removed once object storage is connected.
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