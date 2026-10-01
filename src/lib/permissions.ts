import { WorkspaceRole } from '@/types';

/**
 * Single source of truth for what each role may do.
 *
 * This drives the UI only. The authoritative enforcement lives in
 * `firestore.rules`; the two must be kept in sync when a capability changes.
 */
export type WorkspacePermission =
  | 'workspace.view'
  | 'workspace.edit'
  | 'workspace.delete'
  | 'board.view'
  | 'board.create'
  | 'board.edit'
  | 'board.delete'
  | 'task.view'
  | 'task.create'
  | 'task.edit'
  | 'task.delete'
  | 'task.move'
  | 'member.view'
  | 'member.add'
  | 'member.remove'
  | 'member.changeRole';

const viewerPermissions: readonly WorkspacePermission[] = [
  'workspace.view',
  'board.view',
  'task.view',
  'member.view',
];

const managerPermissions: readonly WorkspacePermission[] = [
  ...viewerPermissions,
  'board.create',
  'board.edit',
  'board.delete',
  'task.create',
  'task.edit',
  'task.delete',
  'task.move',
];

const ownerPermissions: readonly WorkspacePermission[] = [
  ...managerPermissions,
  'workspace.edit',
  'workspace.delete',
  'member.add',
  'member.remove',
  'member.changeRole',
];

export const rolePermissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  viewer: viewerPermissions,
  manager: managerPermissions,
  owner: ownerPermissions,
};

/** Roles that may be assigned when adding a member. `owner` is never assignable. */
export const assignableRoles: readonly WorkspaceRole[] = ['manager', 'viewer'];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === 'owner' || value === 'manager' || value === 'viewer';
}

/**
 * Whether `role` is allowed to perform `permission`.
 *
 * A missing or unrecognised role is denied outright, so a malformed or not yet
 * resolved membership document can never widen access. That also means every
 * permission check is false while the role is loading, which is what keeps
 * owner-only controls from flashing.
 */
export function can(role: WorkspaceRole | null | undefined, permission: WorkspacePermission): boolean {
  if (!isWorkspaceRole(role)) return false;
  return rolePermissions[role].includes(permission);
}

/** Owner only. Managers may not add, remove or re-role anybody. */
export function canManageMembers(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'member.add');
}

/** Only an owner may remove a member or change a role. */
export function canRemoveMembers(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'member.remove');
}

export function canChangeRoles(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'member.changeRole');
}

/** Only an owner may rename, recolour or delete the workspace. */
export function canEditWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'workspace.edit');
}

export function canDeleteWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'workspace.delete');
}

/** Managers and owners create and edit boards; viewers only look. */
export function canManageBoards(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'board.create') && can(role, 'board.edit') && can(role, 'board.delete');
}

/**
 * Drag-and-drop and the step buttons are both task moves, so they share one
 * check. A viewer can read the board but cannot persist a new position.
 */
export function canMoveTasks(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'task.move');
}

export function canManageTasks(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'task.create') && can(role, 'task.edit') && can(role, 'task.delete');
}

/**
 * Board/task writes all need the same gate, so the board page asks once.
 */
export function isWorkspaceReadOnly(role: WorkspaceRole | null | undefined): boolean {
  return !canManageTasks(role) || !canMoveTasks(role) || !canManageBoards(role);
}

export const roleLabels: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  viewer: 'Viewer',
};

export const roleDescriptions: Record<WorkspaceRole, string> = {
  owner: 'Full control: boards, tasks, workspace settings, and members.',
  manager: 'Can create, edit and move boards and tasks. Cannot manage members or the workspace.',
  viewer: 'Read-only access to the workspace, its boards and its tasks.',
};
