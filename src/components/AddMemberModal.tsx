'use client';

import { useEffect, useState } from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';
import { WorkspaceRole } from '@/types';
import { assignableRoles, roleDescriptions, roleLabels } from '@/lib/permissions';
import { describeMemberError } from '@/lib/memberErrors';

interface AddMemberModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  workspaceName: string;
  /** The signed-in user's address, so a self-add is caught before submitting. */
  currentUserEmail?: string | null;
  onSubmitAction: (data: { email: string; role: WorkspaceRole }) => Promise<void>;
}

/**
 * Add a member by email address.
 *
 * The email is resolved through the signed-in users' index, so somebody who has
 * never opened Tasky cannot be added — that requirement is surfaced as an error
 * rather than silently accepted.
 */
export default function AddMemberModal({
  isOpen,
  onCloseAction,
  workspaceName,
  currentUserEmail,
  onSubmitAction,
}: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setRole('viewer');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const isSelf = Boolean(
    currentUserEmail && email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase(),
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onCloseAction();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || isSubmitting || isSelf) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitAction({ email: trimmed, role });
      onCloseAction();
    } catch (submitError) {
      setError(describeMemberError(submitError));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/20">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md animate-fadein border border-white/20">
        <div className="flex items-center justify-between p-5 border-b border-gray-200/60">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-mono text-gray-900">Add Member</h2>
              <p className="text-sm text-gray-600 font-mono">{workspaceName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label htmlFor="member-email" className="block text-sm font-bold font-mono text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              autoFocus
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all duration-200 bg-white/80 backdrop-blur-sm"
            />
            <p className="mt-2 text-xs font-mono text-gray-500">
              The person has to have signed in to Tasky with this exact address at least once.
              If they have, check the spelling — the address has to match character for character.
            </p>
            {isSelf && (
              <p className="mt-2 text-xs font-mono font-bold text-amber-700">
                That is your own address — you are already a member of this workspace.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold font-mono text-gray-700 mb-2">Role</label>
            <div className="space-y-2">
              {assignableRoles.map((option) => (
                <label
                  key={option}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    role === option
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="member-role"
                    value={option}
                    checked={role === option}
                    onChange={() => setRole(option)}
                    className="mt-1 accent-black"
                  />
                  <span>
                    <span className="block font-mono font-bold text-sm text-gray-900">
                      {roleLabels[option]}
                    </span>
                    <span className="block text-xs font-mono text-gray-600 mt-0.5">
                      {roleDescriptions[option]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border-2 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-mono text-red-700">{error}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-mono font-bold text-sm hover:bg-gray-50 hover:border-red-300 hover:text-red-500 transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
              <button
                type="submit"
                disabled={!email.trim() || isSubmitting || isSelf}
                className="flex-1 px-5 py-3 bg-black text-white rounded-xl font-mono font-bold text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2 shadow-lg"
              >

              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Member</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes fadein {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadein {
          animation: fadein 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
