'use client';

import { useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { TaskLink } from '@/types';
import { formatDate } from '@/lib/datetime';
import { isAllowedLinkUrl, shortenLinkUrl } from '@/lib/linkValidation';

interface LinkRowProps {
  link: TaskLink;
  currentUserId: string | null;
  /** True when this user may edit this link (its creator, with a role that allows it). */
  canEdit: boolean;
  /** True when this user may delete this link (its creator or the workspace owner). */
  canDelete: boolean;
  /** True while a delete for this row is in flight. */
  deleting: boolean;
  /** Opens the edit dialog through the list. */
  onRequestEditAction: (link: TaskLink) => void;
  /** Opens the shared confirmation dialog; deletion is never immediate. */
  onRequestDeleteAction: (link: TaskLink) => void;
}

/**
 * One external link, with its open, copy, edit and delete affordances.
 *
 * The row mirrors `AttachmentRow`: an icon tile, a title with a metadata line,
 * and a cluster of icon buttons. Title and URL are rendered as React text, so
 * nothing in them can become markup.
 *
 * Open and copy re-check the scheme before acting. The service and the rules
 * both refuse a non-http(s) URL, so this is a second line of defence: a
 * document written by some other path cannot become a `javascript:` navigation
 * through this row.
 */
export function LinkRow({
  link,
  currentUserId,
  canEdit,
  canDelete,
  deleting,
  onRequestEditAction,
  onRequestDeleteAction,
}: LinkRowProps) {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    setNotice(null);
    if (!isAllowedLinkUrl(link.url)) {
      setNotice('This link has an unsupported address and cannot be opened.');
      return;
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    setNotice(null);

    if (!isAllowedLinkUrl(link.url)) {
      setNotice('This link has an unsupported address and cannot be copied.');
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // A non-secure context, a denied permission or a missing API. Say so and
      // leave the URL visible in the row rather than failing silently.
      setNotice('Could not copy automatically. Open the link to use the address.');
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
          <Link2 className="w-4 h-4 text-blue-600" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-bold text-gray-900 break-words">{link.title}</p>
          <p className="font-mono text-[11px] text-gray-500 mt-0.5 break-all">
            {shortenLinkUrl(link.url)}
          </p>
          <p className="font-mono text-[11px] text-gray-400 mt-0.5">
            {link.createdByName || 'Unknown user'}
            {' · '}
            {formatDate(link.createdAt)}
            {link.createdBy === currentUserId && ' · added by you'}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={open}
            className="p-2 bg-black text-white border-2 border-black hover:text-black hover:bg-white hover:border-black rounded-lg transition-colors"
            title="Open link"
            aria-label={`Open ${link.title}`}
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => void copy()}
            className="p-2 bg-black text-white border-2 border-black hover:text-black hover:bg-white hover:border-black rounded-lg transition-colors"
            title="Copy link address"
            aria-label={`Copy address for ${link.title}`}
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => onRequestEditAction(link)}
              className="p-2 bg-black text-white border-2 border-black hover:text-black hover:bg-white hover:border-black rounded-lg transition-colors"
              title="Edit link"
              aria-label={`Edit ${link.title}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onRequestDeleteAction(link)}
              disabled={deleting}
              className="p-2 bg-black text-white border-2 border-black hover:text-red-600 hover:bg-red-50 hover:border-red-600 rounded-lg transition-colors disabled:opacity-50"
              title="Delete link"
              aria-label={`Delete ${link.title}`}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {notice}
        </p>
      )}
    </li>
  );
}
