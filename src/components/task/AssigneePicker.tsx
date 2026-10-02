'use client';

import { useMemo, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import type { WorkspaceMember } from '@/types';

interface AssigneePickerProps {
  /** Every member of the workspace. Assignees are drawn from this list only. */
  members: WorkspaceMember[];
  /** Currently selected uids, in order. */
  selected: string[];
  onChange: (uids: string[]) => void;
  disabled?: boolean;
}

/**
 * The most people a task may be assigned to.
 *
 * Mirrored by the `<= 5` check in `allAssigneesAreMembers` in firestore.rules,
 * which is the authority: this constant exists so the picker stops at the same
 * number rather than letting a person build a selection the rules will refuse.
 * The bound is set by Firestore's 10-document-read limit per request, not by
 * product preference — see the comment in the rules file.
 */
export const MAX_ASSIGNEES = 5;

/**
 * Multi-select over the workspace member list.
 *
 * The list is the *only* source of assignable people. There is no free-text
 * lookup and no uid entry field, so a task cannot be assigned to somebody
 * outside the workspace from this UI — and the Firestore rules reject an id that
 * is not in the workspace's member list even if a client tries.
 *
 * Selection is order-sensitive: the first person chosen becomes the task's
 * primary assignee, which is what `assigneeId` mirrors for the parts of the app
 * that still read the single-assignee fields.
 */
export function AssigneePicker({ members, selected, onChange, disabled = false }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(members.map((member) => [member.uid, member])), [members]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      `${member.displayName ?? ''} ${member.email ?? ''}`.toLowerCase().includes(needle),
    );
  }, [members, query]);

  const selectedMembers = selected
    .map((uid) => byId.get(uid))
    .filter((member): member is WorkspaceMember => member !== undefined);

  const atCapacity = selected.length >= MAX_ASSIGNEES;

  const toggle = (uid: string) => {
    if (disabled) return;
    if (selected.includes(uid)) {
      onChange(selected.filter((id) => id !== uid));
    } else if (!atCapacity) {
      onChange([...selected, uid]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-2">
        {selectedMembers.length === 0 ? (
          <p className="text-xs font-mono text-gray-500">No one assigned</p>
        ) : (
          selectedMembers.map((member, index) => (
            <span
              key={member.uid}
              className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-gray-100 border border-gray-300 font-mono text-xs"
            >
              <MemberAvatar member={member} size="sm" />
              <span className="text-gray-800">
                {member.displayName || member.email || 'Unknown user'}
              </span>
              {index === 0 && (
                <span className="text-[10px] uppercase tracking-wide text-gray-500">primary</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(member.uid)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  aria-label={`Remove ${member.displayName || member.email}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-gray-200 rounded-lg font-mono text-xs font-bold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Users className="w-3.5 h-3.5" />
        {open ? 'Done choosing' : 'Choose assignees'}
      </button>

      {open && (
        <div className="rounded-lg border-2 border-gray-200 bg-white overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter members..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          </div>

          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((member) => {
              const isSelected = selected.includes(member.uid);
              const blocked = !isSelected && atCapacity;
              return (
                <li key={member.uid}>
                  <button
                    type="button"
                    onClick={() => toggle(member.uid)}
                    disabled={blocked}
                    className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                      isSelected ? 'bg-blue-50' : blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}
                  >
                    <MemberAvatar member={member} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm text-gray-900 truncate">
                        {member.displayName || member.email || 'Unknown user'}
                      </span>
                      <span className="block font-mono text-[11px] text-gray-500 truncate">
                        {member.email || 'No email on file'}
                      </span>
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center font-mono text-xs text-gray-500">
              No workspace member matches &quot;{query}&quot;.
            </p>
          )}

          <p className="px-3 py-2 border-t border-gray-100 font-mono text-[11px] text-gray-500">
            {selected.length} of {MAX_ASSIGNEES} assignees
            {atCapacity && ' — remove someone to add another'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Member avatar.
 *
 * A plain `<img>` rather than `next/image`, because a member photo URL comes from
 * a membership document written by another person and therefore points at an
 * arbitrary host — which `next.config.ts` would have to be reconfigured to
 * allow. The initials fallback also covers a broken or blocked URL.
 */
export function MemberAvatar({
  member,
  size = 'md',
}: {
  member: WorkspaceMember;
  size?: 'sm' | 'md';
}) {
  const dimensions = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';
  const initials = (member.displayName || member.email || '?').charAt(0).toUpperCase();

  if (member.photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.photoURL}
        alt={member.displayName || 'Member'}
        className={`${dimensions} rounded-full object-cover flex-shrink-0 bg-gray-200`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`${dimensions} rounded-full bg-black text-white font-bold flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </span>
  );
}