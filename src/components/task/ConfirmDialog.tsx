'use client';

import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  /** Rendered above the buttons. Use it for the consequences list. */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red for destructive actions, black for everything else. */
  tone?: 'danger' | 'default';
  busy?: boolean;
  busyLabel?: string;
}

/**
 * The confirmation dialog used by every destructive action in this phase.
 *
 * Extracted so archive-permanent-delete, comment delete and attachment delete
 * cannot drift apart, and so the backdrop, Escape handling, scroll lock and
 * pending state behave identically in all three.
 *
 * Escape and the backdrop are both inert while `busy` is set, so a half-finished
 * write cannot be abandoned halfway with no feedback.
 */
export function ConfirmDialog({
  isOpen,
  title,
  subtitle,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  busy = false,
  busyLabel = 'Working...',
}: ConfirmDialogProps) {
  // Lock the page behind the dialog. The board is a scrollable page, and without
  // this the background scrolls under a modal that is meant to be the only thing
  // happening.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:border-red-300'
      : 'bg-black text-white border-black hover:bg-gray-800 disabled:bg-gray-400 disabled:border-gray-400';

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                tone === 'danger' ? 'bg-red-500' : 'bg-black'
              }`}
            >
              <span className="text-white font-bold text-lg leading-none">!</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold font-mono text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-600 font-mono">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">{children}</div>

        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 px-4 py-2.5 rounded-lg font-mono font-bold text-sm border-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${confirmClasses}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{busy ? busyLabel : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}