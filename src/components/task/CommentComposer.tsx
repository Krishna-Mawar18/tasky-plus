'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { MAX_COMMENT_LENGTH } from '@/lib/commentService';

interface CommentComposerProps {
  /** Post a comment. Rejects so the composer can surface the reason inline. */
  onSubmit: (content: string) => Promise<void>;
  submitting: boolean;
  /** Viewers may comment, so the composer is shown to every role. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * The comment box.
 *
 * A plain textarea, not an editor. The brief rules out a rich-text editor and a
 * Markdown source box is the honest input for Markdown output: what is typed is
 * what is stored, and the rendered form appears underneath in the thread.
 *
 * Ctrl/Cmd+Enter submits. An empty comment and an over-long one are both blocked
 * here as a courtesy — the service and the rules reject them independently.
 */
export function CommentComposer({
  onSubmit,
  submitting,
  disabled = false,
  disabledReason,
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMounted = useRef(false);

  // Put the caret back in the box after a post, so a second comment can be typed
  // without reaching for the mouse. Skipped on the first render: the composer is
  // near the bottom of the task modal, and focusing it on open would scroll the
  // description out of view before the reader has seen it.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (!submitting) textareaRef.current?.focus();
  }, [submitting]);

  const trimmed = content.trim();
  const tooLong = content.length > MAX_COMMENT_LENGTH;
  const canSubmit = !disabled && !submitting && trimmed.length > 0 && !tooLong;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit(trimmed);
      setContent('');
    } catch (cause) {
      // Keep the draft. Losing somebody's words because the write was refused is
      // the worst possible outcome here.
      setError(cause instanceof Error ? cause.message : 'Could not post this comment.');
    }
  };

  if (disabled) {
    return (
      <p className="text-xs font-mono text-gray-500 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3">
        {disabledReason ?? 'You cannot comment on this task.'}
      </p>
    );
  }

  return (
    <div className="border-2 border-gray-200 rounded-xl bg-white focus-within:border-gray-400 transition-colors">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
        }}
        rows={3}
        maxLength={MAX_COMMENT_LENGTH * 2}
        placeholder="Write a comment... Markdown is supported."
        aria-label="Write a comment"
        className="w-full px-4 py-3 bg-transparent font-mono text-sm focus:outline-none resize-y placeholder:text-gray-400"
      />

      {error && (
        <p className="px-4 pb-2 text-xs font-mono text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <span
          className={`text-[11px] font-mono ${tooLong ? 'text-red-600 font-bold' : 'text-gray-400'}`}
        >
          {content.length > MAX_COMMENT_LENGTH
            ? `${content.length - MAX_COMMENT_LENGTH} over the limit`
            : `${MAX_COMMENT_LENGTH - content.length} left`}
          {' · '}
          <span className="hidden sm:inline">Ctrl+Enter to post</span>
        </span>

        <div className="flex items-center gap-2">
          {content.length > 0 && !submitting && (
            <button
              type="button"
              onClick={() => setContent('')}
              className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Clear comment"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg font-mono font-bold text-xs border-2 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Posting</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Comment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}