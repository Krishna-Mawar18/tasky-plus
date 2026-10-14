import type { JsonSchemaObject, JsonSchemaProperty, MarkToolDefinition } from '@/mark/types';

/**
 * The complete Mark tool catalog.
 *
 * This file is the single allowlist. It is pure data — it imports no Firebase,
 * no provider, and no DOM — so the server route can build the provider's tool
 * list from it while the browser uses the same names to dispatch executors.
 *
 * `risk` and `mutating` are declared here and never taken from the model. An
 * unknown tool name, or one absent from this list, is rejected before it can do
 * anything.
 */

const str = (description: string, extra: Partial<JsonSchemaProperty> = {}): JsonSchemaProperty => ({
  type: 'string',
  description,
  ...extra,
});

const strEnum = (description: string, values: string[]): JsonSchemaProperty => ({
  type: 'string',
  description,
  enum: values,
});

const bool = (description: string): JsonSchemaProperty => ({ type: 'boolean', description });

const strArray = (description: string): JsonSchemaProperty => ({
  type: 'array',
  description,
  items: { type: 'string' },
});

const obj = (
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
): JsonSchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const WS = str('The workspace id.');
const BOARD = str('The board id, which belongs to the given workspace.');
const TASK = str('The task id, which belongs to the given board.');
const COMMENT = str('The comment id, which belongs to the given task.');
const LINK = str('The link id, which belongs to the given task.');

export const MARK_TOOL_DEFINITIONS: readonly MarkToolDefinition[] = [
  // ---- Identity ---------------------------------------------------------
  {
    name: 'get_current_user',
    description:
      'Identify the signed-in user. When a workspaceId is given, also return the current user’s effective role in that workspace. Use this to answer "who am I?" or to check your own role; the identity comes from the verified session, so never guess it and never ask the user for their own uid or role.',
    risk: 'read',
    mutating: false,
    parameters: obj(
      { workspaceId: str('Optional workspace id, to resolve the current user’s role in that workspace.') },
      [],
    ),
  },

  // ---- Workspaces -------------------------------------------------------
  {
    name: 'list_workspaces',
    description: 'List the workspaces the current user can access.',
    risk: 'read',
    mutating: false,
    parameters: obj({}, []),
  },
  {
    name: 'get_workspace',
    description: 'Read a single workspace the current user can access.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },
  {
    name: 'create_workspace',
    description: 'Create a new workspace owned by the current user.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        name: str('The workspace name.'),
        description: str('An optional short description.'),
        color: str('An optional Tailwind color class, for example "blue".'),
      },
      ['name'],
    ),
  },
  {
    name: 'update_workspace',
    description: 'Update the name, description or color of a workspace the current user owns.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        name: str('A new workspace name.'),
        description: str('A new description.'),
        color: str('A new Tailwind color class.'),
      },
      ['workspaceId'],
    ),
  },
  {
    name: 'delete_workspace',
    description: 'Permanently delete a workspace and its memberships. Destructive; requires approval.',
    risk: 'destructive',
    mutating: true,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },

  // ---- Members (read-only) ---------------------------------------------
  {
    name: 'list_workspace_members',
    description: 'List the members of a workspace with their roles. Read-only.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },

  // ---- Boards -----------------------------------------------------------
  {
    name: 'list_boards',
    description: 'List the boards in a workspace.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },
  {
    name: 'get_board',
    description: 'Read a single board, including its columns.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD }, ['workspaceId', 'boardId']),
  },
  {
    name: 'create_board',
    description: 'Create a board in a workspace. Default columns are To Do, In Progress, Done.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        name: str('The board name.'),
        description: str('An optional short description.'),
      },
      ['workspaceId', 'name'],
    ),
  },
  {
    name: 'update_board',
    description: 'Update the name, description or color of a board.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        name: str('A new board name.'),
        description: str('A new description.'),
        color: str('A new Tailwind color class.'),
      },
      ['workspaceId', 'boardId'],
    ),
  },
  {
    name: 'delete_board',
    description: 'Permanently delete a board. Destructive; requires approval.',
    risk: 'destructive',
    mutating: true,
    parameters: obj({ workspaceId: WS, boardId: BOARD }, ['workspaceId', 'boardId']),
  },

  // ---- Tasks: read ------------------------------------------------------
  {
    name: 'list_tasks',
    description: 'List the tasks on a board. Archived tasks are excluded unless requested.',
    risk: 'read',
    mutating: false,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        includeArchived: bool('Include archived tasks as well as active ones.'),
      },
      ['workspaceId', 'boardId'],
    ),
  },
  {
    name: 'get_task',
    description: 'Read a single task with its assignees, tags and dates.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },
  {
    name: 'search_tasks',
    description: 'Search tasks in a workspace by title or description text.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, query: str('The search text.') }, ['workspaceId', 'query']),
  },

  // ---- Tasks: write -----------------------------------------------------
  {
    name: 'create_task',
    description: 'Create a task in a column of a board.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        columnId: str('The target column id, which must belong to the board.'),
        title: str('The task title.'),
        description: str('An optional Markdown description.'),
        priority: strEnum('The task priority.', ['low', 'medium', 'high']),
        dueDate: str('An optional ISO date or datetime string.'),
        tags: strArray('Optional tags.'),
        assigneeIds: strArray('Optional workspace member uids to assign, at most five.'),
      },
      ['workspaceId', 'boardId', 'columnId', 'title'],
    ),
  },
  {
    name: 'update_task',
    description: 'Update the title, description, priority, due date or tags of a task.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        taskId: TASK,
        title: str('A new title.'),
        description: str('A new Markdown description.'),
        priority: strEnum('A new priority.', ['low', 'medium', 'high']),
        dueDate: str('A new ISO date or datetime string, or an empty string to clear it.'),
        tags: strArray('The replacement tag list.'),
      },
      ['workspaceId', 'boardId', 'taskId'],
    ),
  },
  {
    name: 'move_task',
    description: 'Move a task to another column on the same board.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        taskId: TASK,
        targetColumnId: str('The target column id, which must belong to the board.'),
      },
      ['workspaceId', 'boardId', 'taskId', 'targetColumnId'],
    ),
  },
  {
    name: 'assign_task',
    description: 'Replace the assignees of a task with the given workspace members (at most five).',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      {
        workspaceId: WS,
        boardId: BOARD,
        taskId: TASK,
        assigneeIds: strArray('Workspace member uids. An empty list unassigns everyone.'),
      },
      ['workspaceId', 'boardId', 'taskId', 'assigneeIds'],
    ),
  },
  {
    name: 'archive_task',
    description: 'Archive a task so it leaves the board without being deleted.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },
  {
    name: 'restore_task',
    description: 'Restore an archived task back onto the board.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task and its comments, links and attachment metadata. Destructive; requires approval.',
    risk: 'destructive',
    mutating: true,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },

  // ---- Comments ---------------------------------------------------------
  {
    name: 'list_comments',
    description: 'Read the comments on a task.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },
  {
    name: 'create_comment',
    description: 'Add a comment to a task.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      { workspaceId: WS, boardId: BOARD, taskId: TASK, content: str('The Markdown comment text.') },
      ['workspaceId', 'boardId', 'taskId', 'content'],
    ),
  },
  {
    name: 'update_comment',
    description: 'Edit one of the current user’s own comments on a task.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      { workspaceId: WS, boardId: BOARD, taskId: TASK, commentId: COMMENT, content: str('The new Markdown text.') },
      ['workspaceId', 'boardId', 'taskId', 'commentId', 'content'],
    ),
  },
  {
    name: 'delete_comment',
    description: 'Delete a comment. Destructive; requires approval.',
    risk: 'destructive',
    mutating: true,
    parameters: obj(
      { workspaceId: WS, boardId: BOARD, taskId: TASK, commentId: COMMENT },
      ['workspaceId', 'boardId', 'taskId', 'commentId'],
    ),
  },

  // ---- Links ------------------------------------------------------------
  {
    name: 'list_links',
    description: 'Read the external links attached to a task.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },
  {
    name: 'add_link',
    description: 'Attach an external http(s) link to a task.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj(
      { workspaceId: WS, boardId: BOARD, taskId: TASK, title: str('The link title.'), url: str('An absolute http(s) URL.') },
      ['workspaceId', 'boardId', 'taskId', 'title', 'url'],
    ),
  },
  {
    name: 'delete_link',
    description: 'Remove an external link from a task. Destructive; requires approval.',
    risk: 'destructive',
    mutating: true,
    parameters: obj(
      { workspaceId: WS, boardId: BOARD, taskId: TASK, linkId: LINK },
      ['workspaceId', 'boardId', 'taskId', 'linkId'],
    ),
  },

  // ---- Attachments (metadata count only) --------------------------------
  {
    name: 'get_attachment_count',
    description:
      'Return the number of file attachments recorded on a task. Mark cannot read, open or download attachment contents.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD, taskId: TASK }, ['workspaceId', 'boardId', 'taskId']),
  },

  // ---- Analytics --------------------------------------------------------
  {
    name: 'get_workspace_analytics',
    description: 'Deterministic counts and status breakdown across a workspace.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },
  {
    name: 'get_board_analytics',
    description: 'Deterministic counts, completion and overdue breakdown for a board.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD }, ['workspaceId', 'boardId']),
  },
  {
    name: 'get_member_workload',
    description: 'Deterministic count of open tasks per workspace member.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS }, ['workspaceId']),
  },
  {
    name: 'get_overdue_tasks',
    description: 'List overdue, not-completed tasks, optionally limited to one board.',
    risk: 'read',
    mutating: false,
    parameters: obj({ workspaceId: WS, boardId: BOARD }, ['workspaceId']),
  },

  // ---- Bulk operations --------------------------------------------------
  {
    name: 'bulk_archive_tasks',
    description: 'Archive several tasks at once. Subject to bulk confirmation.',
    risk: 'normal_write',
    mutating: true,
    parameters: obj({ workspaceId: WS, taskIds: strArray('The task ids to archive.') }, ['workspaceId', 'taskIds']),
  },
  {
    name: 'bulk_delete_tasks',
    description: 'Permanently delete several tasks at once. Destructive; requires approval and a bulk preview.',
    risk: 'destructive',
    mutating: true,
    parameters: obj({ workspaceId: WS, taskIds: strArray('The task ids to delete.') }, ['workspaceId', 'taskIds']),
  },
];

const BY_NAME = new Map(MARK_TOOL_DEFINITIONS.map((definition) => [definition.name, definition]));

export function getToolDefinition(name: string): MarkToolDefinition | undefined {
  return BY_NAME.get(name);
}

export function isKnownTool(name: string): boolean {
  return BY_NAME.has(name);
}
