'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import type { TaskAttachment } from '@/types';
import { attachmentService, describeAttachmentError } from '@/lib/attachmentService';
import { attachmentExtension, formatBytes } from '@/lib/fileValidation';
import { formatDate } from '@/lib/datetime';
import { AttachmentImagePreview } from './AttachmentImagePreview';

interface AttachmentRowProps {
  attachment: TaskAttachment;
  currentUserId: string | null;
  canDelete: boolean;
  deleting: boolean;
  resolvePreviewUrl: (attachment: TaskAttachment) => Promise<string>;
  onRequestDelete: (attachment: TaskAttachment) => void;
}

function iconFor(name: string) {
  const extension = attachmentExtension(name);
  if (extension === '.jpg' || extension === '.jpeg' || extension === '.png') {
    return <ImageIcon className="w-4 h-4 text-purple-500" />;
  }
  if (extension === '.xls' || extension === '.xlsx') {
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  }
  return <FileText className="w-4 h-4 text-red-500" />;
}

/**
 * One attachment: name, type, size, who added it, and the controls the role
 * allows.
 *
 * The download button mints a URL on click rather than storing one, so nothing
 * stale or public is kept in Firestore. While no object store is configured the
 * click reports that instead of following a link to nowhere.
 */
export function AttachmentRow({
  attachment,
  currentUserId,
  canDelete,
  deleting,
  resolvePreviewUrl,
  onRequestDelete,
}: AttachmentRowProps) {
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setNotice(null);
    try {
      const url = await attachmentService.getDownloadUrl(attachment);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setNotice(describeAttachmentError(cause));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
          {iconFor(attachment.name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-bold text-gray-900 break-all">{attachment.name}</p>
          <p className="font-mono text-[11px] text-gray-500 mt-0.5">
            {attachment.contentType || 'unknown type'}
            {' · '}
            {formatBytes(attachment.size)}
            {' · '}
            {formatDate(attachment.createdAt)}
            {attachment.uploadedBy === currentUserId && ' · added by you'}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Download"
            aria-label={`Download ${attachment.name}`}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => onRequestDelete(attachment)}
              disabled={deleting}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Delete attachment"
              aria-label={`Delete ${attachment.name}`}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {notice}
        </p>
      )}

      <AttachmentImagePreview attachment={attachment} resolvePreviewUrl={resolvePreviewUrl} />
    </li>
  );
}