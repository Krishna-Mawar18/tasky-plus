'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Shield, Trash2, UserPlus, Check, X, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceRoleProvider, useWorkspaceRole } from '@/contexts/WorkspaceRoleContext';
import { memberService, workspaceService } from '@/lib/services';
import { Workspace, WorkspaceMember, WorkspaceRole } from '@/types';
import { assignableRoles, roleDescriptions, roleLabels } from '@/lib/permissions';
import { describeMemberError, MemberOperationError } from '@/lib/memberErrors';
import AddMemberModal from '@/components/AddMemberModal';
import type { WorkspacePermission } from '@/lib/permissions';

/**
 * Rendered as a tick/cross list under the role banner, so what a role can
 * actually do is visible on the page instead of having to be discovered by
 * looking for missing buttons. It reads the same permission matrix that gates
 * the controls elsewhere.
 */
const capabilitySummary: { permission: WorkspacePermission; label: string }[] = [
  { permission: 'workspace.view', label: 'View workspace, boards, tasks, members' },
  { permission: 'board.create', label: 'Create, edit and delete boards' },
  { permission: 'task.create', label: 'Create, edit and delete tasks' },
  { permission: 'task.move', label: 'Move tasks (drag and drop)' },
  { permission: 'member.add', label: 'Add members' },
  { permission: 'member.changeRole', label: "Change a member's role" },
  { permission: 'member.remove', label: 'Remove a member' },
  { permission: 'workspace.edit', label: 'Edit the workspace' },
  { permission: 'workspace.delete', label: 'Delete the workspace' },
];

const roleStyles: Record<WorkspaceRole, string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  viewer: 'bg-gray-100 text-gray-700 border-gray-200',
};

function MembersContent() {
  const params = useParams();
  const router = useRouter();
  const { user, emailIndexed, emailIndexBusy, refreshEmailIndex } = useAuth();
  const workspaceId = params.workspaceId as string;
  const { role, loading: roleLoading, isOwner, isMember, can } = useWorkspaceRole();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const workspaceData = await workspaceService.getWorkspace(workspaceId);
        if (!cancelled) setWorkspace(workspaceData);
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading workspace:', error);
          setWorkspace(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Subscribing keeps the list live when another member is added or removed.
  // It waits for the role first: a non-member cannot read the collection, and
  // subscribing anyway would just produce a permission error for no reason.
  useEffect(() => {
    if (roleLoading || !isMember) {
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    setMembersError(null);

    const unsubscribe = memberService.subscribeToMembers(
      workspaceId,
      (next) => {
        setMembers(next);
        setLoadingMembers(false);
      },
      (error) => {
        setMembersError(describeMemberError(error));
        setLoadingMembers(false);
      },
    );

    return unsubscribe;
  }, [workspaceId, roleLoading, isMember]);

  const handleAdd = useCallback(
    async ({ email, role: newRole }: { email: string; role: WorkspaceRole }) => {
      if (!user) throw new MemberOperationError('not-signed-in');
      await memberService.addMember({
        workspaceId,
        email,
        role: newRole,
        addedBy: user.uid,
        addedByEmail: user.email,
      });
      toast.success(`${email} added as ${roleLabels[newRole].toLowerCase()}.`);
    },
    [user, workspaceId],
  );

  const handleRoleChange = async (member: WorkspaceMember, nextRole: WorkspaceRole) => {
    setBusyMemberId(member.uid);
    try {
      await memberService.changeRole(workspaceId, member.uid, nextRole);
      toast.success(`${member.displayName || member.email || 'Member'} is now a ${roleLabels[nextRole].toLowerCase()}.`);
    } catch (error) {
      toast.error(describeMemberError(error));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    setBusyMemberId(member.uid);
    try {
      await memberService.removeMember(workspaceId, member.uid);
      setPendingRemoval(null);
      toast.success(`${member.displayName || member.email || 'Member'} removed.`);
    } catch (error) {
      toast.error(describeMemberError(error));
    } finally {
      setBusyMemberId(null);
    }
  };

  if (roleLoading || loadingMembers) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-black text-xl font-mono">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading members...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-gray-800 mb-4">Workspace not found</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white/90 border border-gray-200 rounded-2xl p-8 shadow-lg">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-mono font-bold text-gray-800 mb-2">No access</h1>
          <p className="text-gray-600 font-mono mb-6">
            You are not a member of this workspace.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-purple-200 via-blue-100 to-pink-100 rounded-full blur-3xl opacity-60 animate-blob1 z-0" />

      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-[10]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button
                onClick={() => router.push(`/workspace/${workspaceId}`)}
                className="flex items-center px-3 py-3 bg-white/80 hover:bg-black text-gray-800 hover:text-white rounded-xl sm:rounded-2xl transition-all duration-500 border border-gray-300 hover:border-black flex-shrink-0"
                aria-label="Back to workspace"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline font-mono font-bold text-sm ml-2">Workspace</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-mono font-bold text-gray-900 truncate">Members</h1>
                <p className="text-xs sm:text-sm text-gray-600 font-mono truncate">{workspace.name}</p>
              </div>
            </div>

            {can('member.add') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-black text-white px-3 sm:px-4 py-2 rounded-lg font-mono font-bold text-xs sm:text-sm hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 flex items-center space-x-1 sm:space-x-2 flex-shrink-0"
              >
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add Member</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 relative z-[10]">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/90 border border-gray-200 shadow-lg mb-6">
          <Shield className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-mono font-bold text-gray-900 text-sm">
              Your role: {role ? roleLabels[role] : 'None'}
            </p>
            <p className="font-mono text-gray-600 text-xs mt-1">
              {role ? roleDescriptions[role] : 'You do not have access to this workspace.'}
            </p>
            {role && (
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {capabilitySummary.map((capability) => (
                  <li
                    key={capability.permission}
                    className="font-mono text-xs flex items-center gap-2"
                  >
                    {can(capability.permission) ? (
                      <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={can(capability.permission) ? 'text-gray-700' : 'text-gray-400'}>
                      {capability.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {!isOwner && (
          <p className="text-xs font-mono text-gray-500 mb-6">
            Only the workspace owner can add, re-role or remove members.
          </p>
        )}

        {/*
          A refused index publish is the single most common reason "add member by
          email" reports that nobody exists. It is almost always the live security
          rules predating the userEmailIndex collection, so it is worth saying
          plainly instead of leaving the user to guess from a lookup failure.
        */}
        {emailIndexed === false && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border-2 border-amber-200 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono font-bold text-amber-900 text-sm">
                Adding people by email is not working
              </p>
              <p className="font-mono text-amber-800 text-xs mt-1 leading-relaxed">
                Your account could not be published to the email lookup index, so no address
                will resolve — not even your own. This normally means the Firestore security
                rules on the live project have not been updated yet: run{' '}
                <code className="bg-amber-100 px-1 rounded">firebase deploy --only firestore:rules</code>.
                Then try again here.
              </p>
              <button
                type="button"
                onClick={() => void refreshEmailIndex()}
                disabled={emailIndexBusy}
                className="mt-3 px-3 py-1.5 bg-amber-100 border-2 border-amber-300 text-amber-900 rounded-lg font-mono font-bold text-xs hover:bg-amber-200 transition-colors disabled:opacity-50"
              >
                {emailIndexBusy ? 'Publishing...' : 'Publish my address now'}
              </button>
            </div>
          </div>
        )}

        {membersError ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
            <Shield className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="font-mono text-sm text-red-700">{membersError}</p>
          </div>
        ) : (
          <div className="bg-white/90 border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
            {members.map((member) => {
              const isSelf = member.uid === user?.uid;
              const isBusy = busyMemberId === member.uid;
              const canEditThisMember = can('member.changeRole') && !isSelf && member.role !== 'owner';
              const canRemoveThisMember = can('member.remove') && !isSelf && member.role !== 'owner';

              return (
                <li key={member.uid} className="p-4 sm:p-5 flex items-center gap-4">
                  <Avatar member={member} />

                  <div className="min-w-0 flex-1">
                    <p
                      className="font-mono font-bold text-gray-900 truncate"
                      title={member.uid}
                    >
                      {member.displayName || member.email || 'Signed in without a name'}
                      {isSelf && <span className="text-gray-500 font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs font-mono text-gray-500 truncate">
                      {member.email || 'No email on file'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {canEditThisMember ? (
                      <select
                        value={member.role}
                        disabled={isBusy}
                        onChange={(event) =>
                          handleRoleChange(member, event.target.value as WorkspaceRole)
                        }
                        aria-label={`Role for ${member.displayName || member.email}`}
                        className="px-2 sm:px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer disabled:opacity-50"
                      >
                        {assignableRoles.map((option) => (
                          <option key={option} value={option}>
                            {roleLabels[option]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`px-3 py-1.5 rounded-full font-mono text-xs font-bold border ${roleStyles[member.role]}`}
                      >
                        {roleLabels[member.role]}
                      </span>
                    )}

                    {canRemoveThisMember &&
                      (pendingRemoval === member.uid ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(member)}
                            disabled={isBusy}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                            title="Confirm removal"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setPendingRemoval(null)}
                            disabled={isBusy}
                            className="p-2 border-2 border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                            title="Cancel removal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingRemoval(member.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </li>
              );
            })}
            </ul>

            {members.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 font-mono">No members found.</p>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <p className="mt-4 text-xs font-mono text-gray-500">
            As owner you cannot be removed, and ownership cannot be transferred.
          </p>
        )}
      </div>

      <AddMemberModal
        isOpen={showAddModal}
        onCloseAction={() => setShowAddModal(false)}
        workspaceName={workspace.name}
        currentUserEmail={user?.email}
        onSubmitAction={handleAdd}
      />

      <style jsx global>{`
        @keyframes blob1 {
          0%,
          100% {
            transform: scale(1) translateY(0) rotate(0deg);
          }
          50% {
            transform: scale(1.1) translateY(20px) rotate(5deg);
          }
        }
        .animate-blob1 {
          animation: blob1 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function Avatar({ member }: { member: WorkspaceMember }) {
  const [imageError, setImageError] = useState(false);
  const initials = (member.displayName || member.email || '?').charAt(0).toUpperCase();

  if (member.photoURL && !imageError) {
    return (
      <Image
        src={member.photoURL}
        alt={member.displayName || 'Member'}
        width={40}
        height={40}
        className="w-10 h-10 rounded-full flex-shrink-0"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
      <span className="text-white font-bold text-sm">{initials}</span>
    </div>
  );
}

export default function MembersPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  return (
    <WorkspaceRoleProvider workspaceId={workspaceId}>
      <MembersContent />
    </WorkspaceRoleProvider>
  );
}
