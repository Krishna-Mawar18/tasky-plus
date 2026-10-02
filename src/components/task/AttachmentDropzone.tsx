'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, UploadCloud } from 'lucide-react';
import {
  formatAllowedExtensions,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
} from '@/lib/fileValidation';

interface AttachmentDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
}

/**
 * Drag-and-drop target plus a file input.
 *
 * Both routes hand the same `File[]` upward, so a dropped file and a picked file
 * are validated identically. One file at a time in this version — there is no
 * batch path, and dropping several reports which one to keep.
 */
export function AttachmentDropzone({ onFiles, disabled = false, uploading = false }: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dropNotice, setDropNotice] = useState<string | null>(null);

  const handleFiles = (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    if (list.length > 1) {
      setDropNotice(`Only one file can be attached at a time — using "${list[0].name}".`);
    } else {
      setDropNotice(null);
    }

    onFiles([list[0]]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled || uploading) return;
          handleFiles(event.dataTransfer?.files ?? null);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : disabled
              ? 'border-gray-200 bg-gray-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <UploadCloud
          className={`mx-auto w-6 h-6 mb-2 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}
        />
        <p className="font-mono text-xs text-gray-600">
          Drag a file here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="underline font-bold text-gray-900 hover:text-blue-700 transition-colors disabled:no-underline disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            choose one
          </button>
        </p>
        <p className="font-mono text-[11px] text-gray-400 mt-1">
          {formatAllowedExtensions()} · up to {formatBytes(MAX_ATTACHMENT_BYTES)}
        </p>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          // `accept` is a hint for the file picker only. It is never the control:
          // `validateAttachmentFile` re-checks the extension, the reported type
          // and the size before anything is stored.
          accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx,.md"
          disabled={disabled || uploading}
          onChange={(event) => {
            handleFiles(event.target.files);
            // Allow the same file to be picked again after a rejection.
            event.target.value = '';
          }}
        />
      </div>

      {uploading && (
        <p className="flex items-center gap-2 font-mono text-xs text-gray-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Storing file...</span>
        </p>
      )}

      {dropNotice && (
        <p className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {dropNotice}
        </p>
      )}

      {!disabled && !uploading && (
        <p className="font-mono text-[11px] text-gray-400 flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" />
          One file at a time. Names must be unique within this task.
        </p>
      )}
    </div>
  );
}