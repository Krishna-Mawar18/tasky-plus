'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Link2, Loader2, X } from 'lucide-react';
import { describeLinkError } from '@/lib/linkService';
import {
  MAX_LINK_TITLE_LENGTH,
  shortenLinkUrl,
  validateLinkTitle,
  validateLinkUrl,
} from '@/lib/linkValidation';

interface LinkDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  /** Prepopulated values in edit mode. */
  initialTitle?: string;
  initialUrl?: string;
  onCancelAction: () => void;
  /** Resolves on success (the parent closes the dialog), rejects to show the reason. */
  onSubmitAction: (values: { title: string; url: string }) => Promise<void>;
}

/**
 * The Add Link / Edit Link dialog.
 *
 * A single component for both modes, so the validation, the preview and the
 * keyboard handling cannot drift between adding and editing a link.
 *
 * Escape and the backdrop close it, but neither is inert while a write is in
 * flight, so a half-finished save cannot be abandoned with no feedback. Input
 * is preserved on a recoverable failure — losing a typed URL to a permission
 * error would be the worst possible outcome here.
 */
export function LinkDialog({
  isOpen,
  mode,
  initialTitle = '',
  initialUrl = '',
  onCancelAction,
  onSubmitAction,
}: LinkDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [submitted, setSubmitted] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const urlId = useId();
  const descriptionId = useId();

  const titleValidation = validateLinkTitle(title);
  const urlValidation = validateLinkUrl(url);
  const showTitleError = (titleTouched || submitted) && !titleValidation.valid;
  const showUrlError = (urlTouched || submitted) && !urlValidation.valid;
  const canSubmit = titleValidation.valid && urlValidation.valid && !busy;

  // Reset to the incoming values each time the dialog opens. Keyed on `isOpen`
  // and the mode so switching from add to edit (or to a different link) never
  // shows the previous draft.
  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTitle);
    setUrl(initialUrl);
    setSubmitted(false);
    setTitleTouched(false);
    setUrlTouched(false);
    setSubmitError(null);
    setBusy(false);
  }, [isOpen, mode, initialTitle, initialUrl]);

  // Focus the first field on open. A dialog that opens with focus still on the
  // board behind it is a keyboard dead end.
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Lock the page behind the dialog and close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancelAction();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, busy, onCancelAction]);

  if (!isOpen) return null;

  const editing = mode === 'edit';
  const heading = editing ? 'Edit Link' : 'Add Link';

  const submit = async () => {
    setSubmitted(true);
    if (!titleValidation.valid || !urlValidation.valid || busy) return;

    setBusy(true);
    setSubmitError(null);
    try {
      await onSubmitAction({ title: title.trim(), url: url.trim() });
    } catch (cause) {
      setSubmitError(describeLinkError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${titleId}-heading`}
      aria-describedby={descriptionId}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancelAction}
      />

      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fadeIn max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2
                id={`${titleId}-heading`}
                className="text-lg font-bold font-mono text-gray-900"
              >
                {heading}
              </h2>
              <p id={descriptionId} className="text-xs text-gray-600 font-mono">
                {editing
                  ? 'Update this reference on the task.'
                  : 'Save a URL as a reference on this task. It opens in a new tab.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelAction}
            disabled={busy}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="flex-1 overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div className="p-5 space-y-4">
            <div>
              <label
                htmlFor={titleId}
                className="block text-xs font-bold font-mono text-gray-700 mb-1.5"
              >
                Link title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                id={titleId}
                type="text"
                value={title}
                maxLength={MAX_LINK_TITLE_LENGTH * 2}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => setTitleTouched(true)}
                placeholder="Design spec"
                aria-invalid={showTitleError}
                aria-describedby={showTitleError ? `${titleId}-error` : undefined}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400"
              />
              {showTitleError && (
                <p id={`${titleId}-error`} className="mt-1 text-[11px] font-mono text-red-600" role="alert">
                  {titleValidation.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={urlId}
                className="block text-xs font-bold font-mono text-gray-700 mb-1.5"
              >
                URL <span className="text-red-500">*</span>
              </label>
              <input
                id={urlId}
                type="url"
                value={url}
                inputMode="url"
                onChange={(event) => setUrl(event.target.value)}
                onBlur={() => setUrlTouched(true)}
                placeholder="https://example.com/page"
                aria-invalid={showUrlError}
                aria-describedby={showUrlError ? `${urlId}-error` : undefined}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400"
              />
              {showUrlError && (
                <p id={`${urlId}-error`} className="mt-1 text-[11px] font-mono text-red-600" role="alert">
                  {urlValidation.message}
                </p>
              )}
            </div>

            {/* Live preview */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wide text-gray-400 mb-2">
                Preview
              </p>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-gray-900 break-words">
                    {title.trim() || <span className="text-gray-400 font-normal">Your link title</span>}
                  </p>
                  <p className="font-mono text-[11px] text-gray-500 mt-0.5 break-all">
                    {urlValidation.valid
                      ? shortenLinkUrl(url)
                      : <span className="text-gray-400">https://example.com</span>}
                  </p>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-red-700 flex-1" role="alert">
                  {submitError}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-5 pb-5">
            <button
              type="button"
              onClick={onCancelAction}
              disabled={busy}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-mono font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg font-mono font-bold text-sm border-2 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{busy ? 'Saving' : editing ? 'Save changes' : 'Add Link'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
