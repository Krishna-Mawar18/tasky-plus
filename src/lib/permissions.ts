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
  | 'task.archive'
  | 'task.move'
  | 'member.view'
  | 'member.add'
  | 'member.remove'
  | 'member.changeRole'
  | 'comment.view'
  | 'comment.create'
  | 'comment.editOwn'
  | 'comment.deleteOwn'
  | 'comment.deleteAny'
  | 'attachment.view'
  | 'attachment.upload'
  | 'attachment.deleteOwn'
  | 'attachment.deleteAny';

const viewerPermissions: readonly WorkspacePermission[] = [
  'workspace.view',
  'board.view',
  'task.view',
  'member.view',
  // A viewer may take part in a discussion. This is deliberate and does not
  // imply any task-editing capability: `task.create`/`task.edit`/
  // `task.archive`/`task.delete` stay off the viewer list, so commenting can
  // never be mistaken for permission to change the work.
  'comment.view',
  'comment.create',
  'comment.editOwn',
  'comment.deleteOwn',
  // Read-only on attachments. A viewer can see what is attached and download
  // it, but cannot add or remove anything.
  'attachment.view',
];

const managerPermissions: readonly WorkspacePermission[] = [
  ...viewerPermissions,
  'board.create',
  'board.edit',
  'board.delete',
  'task.create',
  'task.edit',
  'task.delete',
  // Archiving and restoring are ordinary task administration, so they follow
  // `task.edit`/`task.delete` rather than being an owner-only capability.
  'task.archive',
  'task.move',
  'attachment.upload',
  'attachment.deleteOwn',
];

const ownerPermissions: readonly WorkspacePermission[] = [
  ...managerPermissions,
  'workspace.edit',
  'workspace.delete',
  'member.add',
  'member.remove',
  'member.changeRole',
  // Cleaning up after other people is an owner responsibility; a manager is
  // limited to their own comments and their own attachments.
  'comment.deleteAny',
  'attachment.deleteAny',
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
 * Archiving, restoring and permanent deletion.
 *
 * All three are manager-and-above and share one gate, because the board offers
 * them from the same menus and the rules apply the same check to all three.
 */
export function canArchiveTasks(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'task.archive');
}

/** Anybody in the workspace may join the discussion on a task. */
export function canComment(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'comment.create');
}

/**
 * Whether this user may delete one specific comment.
 *
 * Owners clear up after anybody; everyone else is limited to their own. The
 * Firestore rules enforce exactly this, so hiding the button is a convenience
 * rather than the control.
 */
export function canDeleteComment(
  role: WorkspaceRole | null | undefined,
  commentAuthorId: string,
  currentUserId: string | null | undefined,
): boolean {
  if (can(role, 'comment.deleteAny')) return true;
  return can(role, 'comment.deleteOwn') && commentAuthorId === currentUserId;
}

/** Whether the attachment section should offer an upload control at all. */
export function canUploadAttachments(role: WorkspaceRole | null | undefined): boolean {
  return can(role, 'attachment.upload');
}

/**
 * Whether this user may delete one specific attachment: owners delete any,
 * managers only their own, viewers nothing.
 */
export function canDeleteAttachment(
  role: WorkspaceRole | null | undefined,
  attachmentUploaderId: string,
  currentUserId: string | null | undefined,
): boolean {
  if (can(role, 'attachment.deleteAny')) return true;
  return can(role, 'attachment.deleteOwn') && attachmentUploaderId === currentUserId;
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
  viewer: 'Can read boards and tasks and take part in comment threads, but cannot create, edit, move or archive anything.',
};
