import { boardService, memberService, taskService, workspaceService } from '@/lib/services';
import type { Board, Task, Workspace, WorkspaceRole } from '@/types';

export interface AccessOk<T> {
  ok: true;
  value: T;
  role: WorkspaceRole;
}

export interface AccessFail {
  ok: false;
  reason: string;
}

export type Access<T> = AccessOk<T> | AccessFail;

/**
 * Server-validated resource resolution.
 *
 * Every id the model supplies is untrusted. These helpers confirm the resource
 * exists, is reachable by the caller, and belongs to the expected parent chain
 * (workspace → board → task). A failure returns the same generic reason whether
 * the resource is missing or simply unauthorized, so the guard cannot be used to
 * probe for the existence of protected resources.
 *
 * The reads themselves run under the caller's Firebase session, so the
 * authoritative check is still `firestore.rules`; these helpers add the
 * relationship checks the rules cannot express through a query.
 */

const NOT_AUTHORIZED = 'That resource was not found, or you do not have access to it.';

export async function resolveWorkspaceAccess(workspaceId: string, uid: string): Promise<Access<Workspace>> {
  if (!workspaceId) return { ok: false, reason: NOT_AUTHORIZED };
  const workspace = await workspaceService.getWorkspace(workspaceId);
  if (!workspace) return { ok: false, reason: NOT_AUTHORIZED };

  const role: WorkspaceRole | null =
    workspace.ownerId === uid ? 'owner' : await memberService.getRole(workspaceId, uid);
  if (!role) return { ok: false, reason: NOT_AUTHORIZED };

  return { ok: true, value: workspace, role };
}

export async function resolveBoardAccess(
  workspaceId: string,
  boardId: string,
  uid: string,
): Promise<Access<Board>> {
  const workspace = await resolveWorkspaceAccess(workspaceId, uid);
  if (!workspace.ok) return workspace;
  if (!boardId) return { ok: false, reason: NOT_AUTHORIZED };

  const board = await boardService.getBoard(boardId);
  if (!board || board.workspaceId !== workspaceId) return { ok: false, reason: NOT_AUTHORIZED };

  return { ok: true, value: board, role: workspace.role };
}

export async function resolveTaskAccess(
  workspaceId: string,
  boardId: string,
  taskId: string,
  uid: string,
): Promise<Access<Task>> {
  const board = await resolveBoardAccess(workspaceId, boardId, uid);
  if (!board.ok) return board;
  if (!taskId) return { ok: false, reason: NOT_AUTHORIZED };

  const tasks = await taskService.getTasksByBoard(boardId);
  const task = tasks.find(
    (candidate) =>
      candidate.id === taskId &&
      candidate.boardId === boardId &&
      (!candidate.workspaceId || candidate.workspaceId === workspaceId),
  );
  if (!task) return { ok: false, reason: NOT_AUTHORIZED };

  return { ok: true, value: task, role: board.role };
}

/** Every task on a board the caller may read. */
export async function listBoardTasks(
  workspaceId: string,
  boardId: string,
  uid: string,
): Promise<Access<Task[]>> {
  const board = await resolveBoardAccess(workspaceId, boardId, uid);
  if (!board.ok) return board;
  const tasks = await taskService.getTasksByBoard(boardId);
  return { ok: true, value: tasks, role: board.role };
}
