'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import type { TaskComment } from '@/types';
import { formatTimestamp } from '@/lib/datetime';
import { MAX_COMMENT_LENGTH } from '@/lib/commentService';
import { Markdown } from './Markdown';

interface CommentItemProps {
  comment: TaskComment;
  /** True when the signed-in user wrote this comment. */
  isOwn: boolean;
  /** Owners may delete anybody's comment; everyone else only their own. */
  canDelete: boolean;
  onSave: (commentId: string, content: string) => Promise<void>;
  /** Opens the shared confirmation dialog; deletion is never immediate. */
  onOpenDeleteConfirm: (comment: TaskComment) => void;
}

/**
 * One comment, with its edit and delete affordances.
 *
 * Deletion is two-step: the trash button opens the shared confirmation dialog
 * rather than removing the comment on the spot, because a comment in a shared
 * thread cannot be recovered once it is gone.
 */
export function CommentItem({
  comment,
  isOwn,
  canDelete,
  onSave,
  onOpenDeleteConfirm,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `updatedAt` is equalised with `createdAt` for a comment that was never
  // edited, so equality is the honest test for "has this been changed".
  const wasEdited =
    comment.updatedAt !== null && comment.createdAt !== null
      ? comment.updatedAt.getTime() > comment.createdAt.getTime()
      : false;

  const authorInitial = comment.authorName.trim().charAt(0).toUpperCase() || '?';

  const startEditing = () => {
    setDraft(comment.content);
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(comment.content);
    setError(null);
  };

  const save = async () => {
    const content = draft.trim();
    if (!content || content.length > MAX_COMMENT_LENGTH) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(comment.id, content);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this comment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="group flex gap-3">
      <div className="flex-shrink-0 pt-0.5">
        {comment.authorPhotoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.authorPhotoURL}
            alt=""
            className="w-8 h-8 rounded-full object-cover bg-gray-200"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center">
            {authorInitial}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-gray-900">{comment.authorName}</span>
          <span className="text-xs font-mono text-gray-500">{formatTimestamp(comment.createdAt)}</span>
          {wasEdited && (
            <span
              className="text-[10px] font-mono uppercase tracking-wide text-gray-500 border border-gray-300 rounded px-1"
              title={`Last edited ${formatTimestamp(comment.updatedAt)}`}
            >
              Edited
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              autoFocus
              aria-label="Edit comment"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-gray-400 resize-y"
            />

            {draft.length > MAX_COMMENT_LENGTH && (
              <p className="text-xs font-mono text-red-600">
                {draft.length - MAX_COMMENT_LENGTH} characters over the limit.
              </p>
            )}
            {error && (
              <p className="text-xs font-mono text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !draft.trim() || draft.length > MAX_COMMENT_LENGTH}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg font-mono font-bold text-xs border-2 border-black hover:bg-white hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-gray-300 rounded-lg font-mono font-bold text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <Markdown content={comment.content} />
            </div>

            {(isOwn || canDelete) && (
              <div className="mt-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {isOwn && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit comment"
                    aria-label="Edit comment"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onOpenDeleteConfirm(comment)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete comment"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}