'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { memberService, workspaceService } from '@/lib/services';
import { WorkspaceRole } from '@/types';
import { WorkspacePermission, can as roleCan } from '@/lib/permissions';

interface WorkspaceRoleContextValue {
  workspaceId: string;
  /** `null` while unresolved, or when the user is not a member. */
  role: WorkspaceRole | null;
  /** Stays `true` until the role is known, so pages can avoid flashing controls. */
  loading: boolean;
  isMember: boolean;
  isOwner: boolean;
  isManager: boolean;
  isViewer: boolean;
  can: (permission: WorkspacePermission) => boolean;
  refresh: () => Promise<void>;
}

const WorkspaceRoleContext = createContext<WorkspaceRoleContextValue | undefined>(undefined);

/**
 * Resolves the signed-in user's role in one workspace and exposes it to the page
 * below.
 *
 * Workspaces created before memberships existed have no membership document for
 * their owner, so the owner path repairs that on the fly. The repair is
 * owner-only and idempotent, and the same code path covers new workspaces whose
 * owner membership was already written at creation time.
 */
export function WorkspaceRoleProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  // Set while the effect is live, so a slow read cannot set state after unmount
  // or after the workspace has changed.
  const active = useRef(true);

  const loadRole = useCallback(async () => {
    if (!user || !workspaceId) {
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!active.current) return;
      if (!workspace) {
        setRole(null);
        return;
      }

      if (user.uid === workspace.ownerId) {
        // Repair a workspace that predates memberships. A failure here must not
        // lock the owner out of the UI: the rules grant the owner everything
        // from `ownerId`, so the role is only a hint about which controls to
        // draw. A corrupt membership document is an operator problem and is
        // reported rather than papered over.
        let ensured: WorkspaceRole | null = null;
        try {
          ensured = await memberService.ensureOwnerMembership(workspaceId, user.uid, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
        } catch (error) {
          console.error('Could not ensure owner membership, continuing as owner:', error);
        }
        if (!active.current) return;
        setRole(ensured ?? 'owner');
        void memberService.syncOwnMemberProfile(workspaceId, user.uid, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
        return;
      }

      const memberRole = await memberService.getRole(workspaceId, user.uid);
      if (!active.current) return;
      setRole(memberRole);
      void memberService.syncOwnMemberProfile(workspaceId, user.uid, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } catch (error) {
      console.error('Error resolving workspace role:', error);
      if (!active.current) return;
      setRole(null);
    } finally {
      if (active.current) setLoading(false);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    active.current = true;
    void loadRole();
    return () => {
      active.current = false;
    };
  }, [loadRole]);

  const value = useMemo<WorkspaceRoleContextValue>(
    () => ({
      workspaceId,
      role,
      loading,
      isMember: role !== null,
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isViewer: role === 'viewer',
      can: (permission: WorkspacePermission) => roleCan(role, permission),
      refresh: loadRole,
    }),
    [workspaceId, role, loading, loadRole],
  );

  return <WorkspaceRoleContext.Provider value={value}>{children}</WorkspaceRoleContext.Provider>;
}

export function useWorkspaceRole(): WorkspaceRoleContextValue {
  const context = useContext(WorkspaceRoleContext);
  if (context === undefined) {
    throw new Error('useWorkspaceRole must be used within a WorkspaceRoleProvider');
  }
  return context;
}
