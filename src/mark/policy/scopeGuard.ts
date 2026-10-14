/**
 * Deterministic Tasky-only scope guard.
 *
 * Runs on the browser before any provider call. It is intentionally
 * conservative: it hard-refuses only when a request is *clearly* unrelated (an
 * obvious out-of-scope intent and no Tasky term at all) or when it is a direct
 * attempt to extract Mark's instructions. Everything ambiguous is `uncertain`
 * and is handed to the model, which is itself scoped by the server system
 * prompt. This guard is a first line, not the only line.
 */

export type ScopeVerdict = 'in_scope' | 'out_of_scope' | 'uncertain' | 'disallowed';

export interface ScopeDecision {
  verdict: ScopeVerdict;
  /** Set only for `out_of_scope` and `disallowed`. */
  reply?: string;
  reason: string;
}

export const OUT_OF_SCOPE_REPLY =
  "I can help with your Tasky work, but I can't perform unrelated tasks. What would you like to manage in your workspaces, boards, tasks, or comments?";

export const INTERNAL_INSTRUCTIONS_REFUSAL =
  "I can't share my internal instructions. What would you like to manage in your Tasky workspaces, boards, tasks, or comments?";

const TASKY_TERMS = [
  'workspace', 'board', 'kanban', 'column', 'task', 'tasks', 'subtask', 'sub-task',
  'assignee', 'assign', 'reassign', 'due date', 'overdue', 'deadline', 'priority',
  'tag', 'comment', 'link', 'archive', 'restore', 'backlog', 'sprint', 'milestone',
  'member', 'role', 'viewer', 'manager', 'owner', 'workload', 'dashboard',
  'to do', 'to-do', 'todo', 'in progress', 'in-progress', 'done', 'project',
  'self-assign', 'unassigned', 'tasky', 'board health', 'attention today',
];

const OUT_OF_SCOPE_PATTERNS = [
  /\bwrite\b.*\b(code|program|script|function|class|component)\b/,
  /\b(python|javascript|typescript|java|rust|golang|c\+\+|sql|html|css)\b/,
  /\breact (component|app|hook)\b/,
  /\b(build|create|make)\b.*\b(react|component|website|landing page)\b/,
  /\b(email|cover letter|resume|cv|essay|poem|song|joke|story|blog post)\b/,
  /\b(recipe|hotel|flight|weather|investment|stock|mortgage|crypto)\b/,
  /\btranslate\b/,
  /\b(generate|create|draw|paint|make)\b.*\b(image|picture|logo|illustration|art)\b/,
  /\b(quantum|physics|chemistry|biology|history|capital of|who is|who was)\b/,
  /\bopenai\b|\bchatgpt\b/,
];

const INJECTION_PATTERNS = [
  /\b(system|developer)\s+(prompt|message|instruction)/,
  /\b(ignore|disregard|forget)\b.*\b(previous|prior|all|above|earlier)\b.*\b(instruction|rule|prompt)/,
  /\b(reveal|show|print|repeat|leak|expose)\b.*\b(instruction|prompt|rule|system|secret|key)\b/,
  /\byou are now\b/,
  /\b(api key|secret key|environment variable|env var)\b/,
];

export function classifyScope(text: string): ScopeDecision {
  const normalized = text.toLowerCase();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { verdict: 'disallowed', reply: INTERNAL_INSTRUCTIONS_REFUSAL, reason: 'instruction-extraction attempt' };
    }
  }

  const hasTaskyTerm = TASKY_TERMS.some((term) => normalized.includes(term));
  const looksUnrelated = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));

  if (looksUnrelated && !hasTaskyTerm) {
    return { verdict: 'out_of_scope', reply: OUT_OF_SCOPE_REPLY, reason: 'no Tasky term and an unrelated intent' };
  }
  if (hasTaskyTerm) {
    return { verdict: 'in_scope', reason: 'mentions a Tasky concept' };
  }
  return { verdict: 'uncertain', reason: 'no clear signal' };
}
