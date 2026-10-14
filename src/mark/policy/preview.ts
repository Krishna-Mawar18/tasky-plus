import type { Task, WorkspaceRole } from '@/types';
import { MARK_LIMITS } from '@/mark/config';
import type { ApprovalAction } from '@/mark/policy/approvals';
import { resolveBoardAccess, resolveTaskAccess, resolveWorkspaceAccess } from '@/mark/resolve';
import { asString, asStringArray, truncate, type ToolUser } from '@/mark/tools/types';
import { attachmentService } from '@/lib/attachmentService';
import { commentService, fetchCommentPage } from '@/lib/commentService';
import { linkService } from '@/lib/linkService';
import { boardService, memberService, taskService } from '@/lib/services';

/** Preview lines never exceed this many entries; the rest are summarised. */
const PREVIEW_LIMIT = 20;

export interface ApprovalPlan {
  action: ApprovalAction;
}

export type PlanResult = ApprovalPlan | { error: string };

/**
 * How many resources an operation is expected to touch.
 *
 * Read from the arguments, never from current Firestore state, so it can be
 * computed before any network call. The real count is re-derived at execution.
 */
export function affectedCountFor(toolName: string, args: Record<string, unknown>): number {
  if (toolName === 'bulk_archive_tasks' || toolName === 'bulk_delete_tasks') {
    return asStringArray(args, 'taskIds').length;
  }
  return 1;
}

function summarisePreview(lines: string[]): string[] {
  if (lines.length <= PREVIEW_LIMIT) return lines;
  return [...lines.slice(0, PREVIEW_LIMIT), `…and ${lines.length - PREVIEW_LIMIT} more`];
}

/** Resolve several task ids that may live on any board in a workspace. */
async function findTasksInWorkspace(
  workspaceId: string,
  taskIds: string[],
  uid: string,
): Promise<
  | { ok: true; role: WorkspaceRole; tasks: Task[]; missing: string[] }
  | { ok: false; reason: string }
> {
  const access = await resolveWorkspaceAccess(workspaceId, uid);
  if (!access.ok) return { ok: false, reason: access.reason };

  const boards = await boardService.getBoards(workspaceId);
  const byId = new Map<string, Task>();
  for (const board of boards) {
    const tasks = await taskService.getTasksByBoard(board.id);
    for (const task of tasks) byId.set(task.id, task);
  }

  const tasks: Task[] = [];
  const missing: string[] = [];
  for (const id of taskIds) {
    const task = byId.get(id);
    if (task) tasks.push(task);
    else missing.push(id);
  }
  return { ok: true, role: access.role, tasks, missing };
}

/**
 * Build the approval bundle an operation shows before it runs.
 *
 * This is the "what exactly will change" step: it re-reads the affected
 * resources and produces a concrete, human-readable preview plus the list of
 * consequences. Nothing here mutates anything.
 */
export async function buildApprovalAction(
  toolName: string,
  args: Record<string, unknown>,
  user: ToolUser,
): Promise<PlanResult> {
  const base = { toolName, arguments: args, risk: 'destructive' as const };

  switch (toolName) {
    case 'delete_task': {
      const access = await resolveTaskAccess(
        asString(args, 'workspaceId'),
        asString(args, 'boardId'),
        asString(args, 'taskId'),
        user.uid,
      );
      if (!access.ok) return { error: access.reason };
      const task = access.value;
      const [comments, links, attachments] = await Promise.all([
        commentService.getCount(task.id),
        linkService.getLinks(task.id).catch(() => []),
        attachmentService.getAttachments(task.id).catch(() => []),
      ]);
      return {
        action: {
          ...base,
          workspaceId: task.workspaceId ?? asString(args, 'workspaceId'),
          resourceIds: [task.id],
          affectedCount: 1,
          preview: summarisePreview([
            `Task: “${task.title}”`,
            `${comments} comment${comments === 1 ? '' : 's'} will be deleted`,
            `${links.length} link${links.length === 1 ? '' : 's'} will be deleted`,
            `${attachments.length} attachment record${attachments.length === 1 ? '' : 's'} will be deleted`,
          ]),
          consequences: [
            'The task, its comments, its links and its attachment records are permanently removed.',
          ],
        },
      };
    }

    case 'delete_board': {
      const access = await resolveBoardAccess(
        asString(args, 'workspaceId'),
        asString(args, 'boardId'),
        user.uid,
      );
      if (!access.ok) return { error: access.reason };
      const board = access.value;
      const tasks = await taskService.getTasksByBoard(board.id).catch(() => []);
      return {
        action: {
          ...base,
          workspaceId: board.workspaceId,
          resourceIds: [board.id],
          affectedCount: 1,
          preview: summarisePreview([
            `Board: “${board.name}”`,
            `${tasks.length} task${tasks.length === 1 ? '' : 's'} currently on the board`,
          ]),
          consequences: [
            'The board is permanently removed.',
            'Tasks on the board are not deleted, but they will no longer be reachable from any board.',
          ],
        },
      };
    }

    case 'delete_workspace': {
      const access = await resolveWorkspaceAccess(asString(args, 'workspaceId'), user.uid);
      if (!access.ok) return { error: access.reason };
      const workspace = access.value;
      const [boards, members] = await Promise.all([
        boardService.getBoards(workspace.id).catch(() => []),
        memberService.getMembers(workspace.id).catch(() => []),
      ]);
      return {
        action: {
          ...base,
          workspaceId: workspace.id,
          resourceIds: [workspace.id],
          affectedCount: 1,
          preview: summarisePreview([
            `Workspace: “${workspace.name}”`,
            `${boards.length} board${boards.length === 1 ? '' : 's'}`,
            `${members.length} member${members.length === 1 ? '' : 's'}`,
          ]),
          consequences: [
            'The workspace and its membership documents are permanently removed.',
            'Boards and tasks that referenced it are left orphaned and will not be reachable.',
          ],
        },
      };
    }

    case 'delete_comment': {
      const access = await resolveTaskAccess(
        asString(args, 'workspaceId'),
        asString(args, 'boardId'),
        asString(args, 'taskId'),
        user.uid,
      );
      if (!access.ok) return { error: access.reason };
      const task = access.value;
      const comment = await findComment(task.id, asString(args, 'commentId'));
      if (!comment) return { error: 'That comment no longer exists.' };
      return {
        action: {
          ...base,
          workspaceId: task.workspaceId ?? asString(args, 'workspaceId'),
          resourceIds: [comment.id],
          affectedCount: 1,
          preview: summarisePreview([
            `Comment by ${comment.authorName}: “${truncate(comment.content, 100)}”`,
            `On task: “${task.title}”`,
          ]),
          consequences: ['The comment is permanently removed.'],
        },
      };
    }

    case 'delete_link': {
      const access = await resolveTaskAccess(
        asString(args, 'workspaceId'),
        asString(args, 'boardId'),
        asString(args, 'taskId'),
        user.uid,
      );
      if (!access.ok) return { error: access.reason };
      const task = access.value;
      const links = await linkService.getLinks(task.id).catch(() => []);
      const link = links.find((candidate) => candidate.id === asString(args, 'linkId'));
      if (!link) return { error: 'That link no longer exists.' };
      return {
        action: {
          ...base,
          workspaceId: task.workspaceId ?? asString(args, 'workspaceId'),
          resourceIds: [link.id],
          affectedCount: 1,
          preview: summarisePreview([`Link: “${link.title}” (${link.hostname})`]),
          consequences: ['The link is permanently removed from the task.'],
        },
      };
    }

    case 'bulk_archive_tasks':
    case 'bulk_delete_tasks': {
      const taskIds = asStringArray(args, 'taskIds');
      if (taskIds.length > MARK_LIMITS.maxResourcesPerOperation) {
        return {
          error: `That is more than the ${MARK_LIMITS.maxResourcesPerOperation} tasks a single operation may touch.`,
        };
      }
      const found = await findTasksInWorkspace(asString(args, 'workspaceId'), taskIds, user.uid);
      if (!found.ok) return { error: found.reason };
      const destructive = toolName === 'bulk_delete_tasks';
      return {
        action: {
          ...base,
          risk: destructive ? 'destructive' : 'normal_write',
          workspaceId: asString(args, 'workspaceId'),
          resourceIds: found.tasks.map((task) => task.id),
          affectedCount: found.tasks.length,
          preview: summarisePreview([
            ...found.tasks.map((task) => `“${task.title}”`),
            ...(found.missing.length > 0 ? [`${found.missing.length} task id(s) were not found and will be skipped`] : []),
          ]),
          consequences: destructive
            ? ['Each listed task, with its comments, links and attachment records, is permanently removed.']
            : ['Each listed task is archived and leaves its board until restored.'],
        },
      };
    }

    default:
      return { error: 'That action cannot be prepared for approval.' };
  }
}

async function findComment(taskId: string, commentId: string) {
  const page = await fetchCommentPage(taskId, { limit: 200 });
  return page.comments.find((comment) => comment.id === commentId) ?? null;
}
