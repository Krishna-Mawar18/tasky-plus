'use client';

import { useEffect, useState } from 'react';
import { FileWarning, ImageOff, Loader2 } from 'lucide-react';
import type { TaskAttachment } from '@/types';
import { isPreviewableImage, attachmentExtension } from '@/lib/fileValidation';
import { describeAttachmentError } from '@/lib/attachmentService';

interface AttachmentImagePreviewProps {
  attachment: TaskAttachment;
  /**
   * Resolves a temporary URL from the storage service.
   *
   * This is the whole contract for inline preview: a component that can mint a
   * short-lived URL renders the image, and anything else renders an explicit
   * "not available" state. It never fabricates a URL from the object key, because
   * a guessed URL would be a broken image dressed up as a working one.
   */
  resolvePreviewUrl: (attachment: TaskAttachment) => Promise<string>;
}

/**
 * Inline preview for jpg/jpeg/png attachments.
 *
 * Only these three formats are previewable. PDF, xls, xlsx and md are
 * download-only by design — there is no viewer, parser or document preview in
 * this phase, and none is planned for Markdown documents.
 */
export function AttachmentImagePreview({
  attachment,
  resolvePreviewUrl,
}: AttachmentImagePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extension = attachmentExtension(attachment.name);

  const previewable =
    extension !== null &&
    isPreviewableImage(extension, attachment.contentType);

  useEffect(() => {
    if (!previewable) return;
    let active = true;

    setLoading(true);
    setError(null);
    resolvePreviewUrl(attachment)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch((cause) => {
        if (active) setError(describeAttachmentError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // `attachment` is a fresh object on each list refresh; the id and key are the
    // only things that should re-trigger a URL request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, attachment.s3Key, previewable]);

  if (!previewable) return null;

  if (loading) {
    return (
      <div className="h-28 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.name}
          className="max-h-48 w-full rounded-lg border border-gray-200 object-cover bg-gray-50"
          referrerPolicy="no-referrer"
        />
      </a>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-300">
      <ImageOff className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-mono text-xs text-gray-600">Preview unavailable</p>
        <p className="font-mono text-[11px] text-gray-500 mt-0.5">
          {error ?? 'A temporary preview URL could not be created.'}
        </p>
      </div>
    </div>
  );
}

/** Formats that are deliberately download-only, explained once in the UI. */
export function DownloadOnlyNotice({ attachment }: { attachment: TaskAttachment }) {
  const extension = attachmentExtension(attachment.name);
  const previewable = extension !== null && isPreviewableImage(extension, attachment.contentType);
  if (previewable) return null;

  return (
    <p className="font-mono text-[11px] text-gray-500 flex items-center gap-1.5">
      <FileWarning className="w-3 h-3" />
      {extension?.toUpperCase().slice(1) ?? 'This format'} files are download only.
    </p>
  );
}