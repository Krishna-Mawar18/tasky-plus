import { can, type WorkspacePermission } from '@/lib/permissions';
import type { WorkspaceRole } from '@/types';
import { getToolDefinition } from '@/mark/tools/definitions';

/**
 * Map every tool onto the existing Tasky permission enum.
 *
 * This deliberately reuses `src/lib/permissions.ts` rather than inventing a
 * second role matrix. It is a UI-side pre-check; the authoritative decision is
 * still `firestore.rules` on the eventual read/write.
 */
const TOOL_PERMISSIONS: Record<string, WorkspacePermission> = {
  get_workspace: 'workspace.view',
  list_workspace_members: 'member.view',
  list_boards: 'board.view',
  get_board: 'board.view',
  list_tasks: 'task.view',
  get_task: 'task.view',
  search_tasks: 'task.view',
  list_comments: 'comment.view',
  list_links: 'link.view',
  get_attachment_count: 'attachment.view',
  get_workspace_analytics: 'workspace.view',
  get_board_analytics: 'board.view',
  get_member_workload: 'workspace.view',
  get_overdue_tasks: 'workspace.view',

  update_workspace: 'workspace.edit',
  delete_workspace: 'workspace.delete',
  create_board: 'board.create',
  update_board: 'board.edit',
  delete_board: 'board.delete',
  create_task: 'task.create',
  update_task: 'task.edit',
  move_task: 'task.move',
  assign_task: 'task.edit',
  archive_task: 'task.archive',
  restore_task: 'task.archive',
  delete_task: 'task.delete',
  create_comment: 'comment.create',
  update_comment: 'comment.editOwn',
  delete_comment: 'comment.deleteOwn',
  add_link: 'link.create',
  delete_link: 'link.deleteOwn',
  bulk_archive_tasks: 'task.archive',
  bulk_delete_tasks: 'task.delete',
};

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

/** Tools that are not scoped to a workspace and are available to any signed-in user. */
const WORKSPACE_AGNOSTIC = new Set(['list_workspaces', 'create_workspace']);

export function authorizeTool(toolName: string, role: WorkspaceRole | null): AuthorizationResult {
  if (!getToolDefinition(toolName)) {
    return { allowed: false, reason: 'That action is not available.' };
  }
  if (WORKSPACE_AGNOSTIC.has(toolName)) {
    return { allowed: true };
  }
  const permission = TOOL_PERMISSIONS[toolName];
  if (!permission) {
    return { allowed: false, reason: 'That action is not available.' };
  }
  if (!can(role, permission)) {
    return { allowed: false, reason: 'Your role does not permit that action in this workspace.' };
  }
  return { allowed: true };
}
