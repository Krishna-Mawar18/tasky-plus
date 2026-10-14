import type { WorkspaceRole } from '@/types';
import { MARK_LIMITS } from '@/mark/config';
import type { MarkClient } from '@/mark/client';
import { Conversation, type FocusContext } from '@/mark/conversation';
import { AuditLog, type AuditOutcome } from '@/mark/audit';
import { ApprovalStore, canonicalKey, type ApprovalRequest } from '@/mark/policy/approvals';
import { authorizeTool } from '@/mark/policy/authorize';
import { affectedCountFor, buildApprovalAction } from '@/mark/policy/preview';
import { assessRisk, type RiskAssessment } from '@/mark/policy/risk';
import { classifyScope } from '@/mark/policy/scopeGuard';
import { resolveWorkspaceAccess } from '@/mark/resolve';
import { getToolDefinition } from '@/mark/tools/definitions';
import { executeTool } from '@/mark/tools/executors';
import { validateArguments } from '@/mark/tools/validate';
import type { ProposedToolCall } from '@/mark/types';
import {
  asString,
  type ToolExecutionContext,
  type ToolUser,
} from '@/mark/tools/types';

/** Everything the UI needs to render, in the order it happens. */
export type MarkEvent =
  | { type: 'user_message'; text: string }
  | { type: 'assistant_text'; text: string }
  | { type: 'tool_activity'; name: string; phase: 'start' | 'ok' | 'error'; detail?: string }
  | { type: 'approval_required'; approval: ApprovalRequest }
  | { type: 'approval_resolved'; id: string; status: 'approved' | 'cancelled' }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface MarkAgentOptions {
  user: ToolUser;
  client: MarkClient;
  onEvent?: (event: MarkEvent) => void;
  now?: () => Date;
}

interface PendingApproval {
  call: ProposedToolCall;
  approval: ApprovalRequest;
  risk: RiskAssessment;
}

type CallEvaluation =
  | { kind: 'error'; message: string }
  | { kind: 'approval'; approval: ApprovalRequest; risk: RiskAssessment }
  | { kind: 'execute'; risk: RiskAssessment };

/**
 * The Mark orchestrator.
 *
 * Owns one conversation. It never talks to Firestore through the model: each
 * turn it asks the provider (via the stateless proxy) what it wants to do, then
 * locally — under the user's own session — authorizes and executes, or pauses
 * for an explicit approval. The provider only ever names a tool and supplies
 * arguments; this class decides whether anything actually happens.
 *
 * Danger is decided here, not by the model: `assessRisk` comes from the catalog,
 * bulk operations past the thresholds always require approval, and only the UI
 * can approve or cancel a pending action.
 */
export class MarkAgent {
  private readonly conversation = new Conversation();
  private readonly approvals = new ApprovalStore();
  private readonly audit = new AuditLog();
  private readonly user: ToolUser;
  private readonly client: MarkClient;
  private readonly onEvent: (event: MarkEvent) => void;
  private readonly now: () => Date;

  private pending: PendingApproval | null = null;
  private busy = false;
  private context: FocusContext = {};

  constructor(options: MarkAgentOptions) {
    this.user = options.user;
    this.client = options.client;
    this.onEvent = options.onEvent ?? (() => {});
    this.now = options.now ?? (() => new Date());
  }

  get pendingApproval(): ApprovalRequest | null {
    return this.pending ? this.pending.approval : null;
  }

  get auditTrail() {
    return this.audit.list();
  }

  /**
   * Set the workspace/board/task the user is currently looking at.
   *
   * This is a hint appended to outbound turns, never an authority: every id is
   * re-resolved and re-authorized at execution time regardless of what is set
   * here. It only saves the model from asking which workspace the user means.
   */
  setContext(context: FocusContext): void {
    this.context = {
      workspaceId: context.workspaceId || undefined,
      boardId: context.boardId || undefined,
      taskId: context.taskId || undefined,
    };
    this.conversation.focus = this.context;
  }

  get currentContext(): FocusContext {
    return { ...this.context };
  }

  /** Send a user turn and drive the loop until it finishes or needs approval. */
  async send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.busy) return;

    this.emit({ type: 'user_message', text: trimmed });
    this.conversation.addUser(this.withContext(trimmed));

    const scope = classifyScope(trimmed);
    if (scope.verdict === 'out_of_scope' || scope.verdict === 'disallowed') {
      const reply = scope.reply ?? "I can only help with your Tasky work.";
      this.conversation.addAssistant({ role: 'assistant', content: reply });
      this.emit({ type: 'assistant_text', text: reply });
      this.emit({ type: 'done' });
      return;
    }

    await this.runLoop();
  }

  /** Approve and run the pending action, then resume the conversation. */
  async approve(id: string): Promise<void> {
    const pending = this.pending;
    if (!pending || pending.approval.id !== id) return;

    const validation = this.approvals.validate(id, this.user.uid, {
      toolName: pending.call.name,
      arguments: pending.call.arguments,
    });
    if (!validation.ok) {
      this.pending = null;
      this.emit({ type: 'approval_resolved', id, status: 'cancelled' });
      this.conversation.addToolResult(
        pending.call.id,
        pending.call.name,
        JSON.stringify({ status: 'cancelled', reason: validation.reason }),
      );
      await this.runLoop();
      return;
    }

    this.approvals.consume(id);
    this.pending = null;
    this.emit({ type: 'approval_resolved', id, status: 'approved' });

    const result = await this.runExecutor(pending.call);
    this.conversation.addToolResult(pending.call.id, pending.call.name, JSON.stringify(result));
    await this.runLoop();
  }

  /** Decline the pending action. The model is told it did not run. */
  async cancel(id: string): Promise<void> {
    const pending = this.pending;
    if (!pending || pending.approval.id !== id) return;

    this.approvals.cancel(id, this.user.uid);
    this.pending = null;
    this.emit({ type: 'approval_resolved', id, status: 'cancelled' });
    this.conversation.addToolResult(
      pending.call.id,
      pending.call.name,
      JSON.stringify({ status: 'cancelled', reason: 'The user declined this action.' }),
    );
    await this.runLoop();
  }

  /** Forget the conversation and any pending approvals. */
  reset(): void {
    this.conversation.reset();
    this.approvals.clear();
    this.pending = null;
  }

  private async runLoop(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    // Track identical actions within this turn so a model that keeps re-issuing
    // the same call (for example after a failed write) cannot spin the loop.
    const attempted = new Map<string, number>();
    try {
      for (let step = 0; step < MARK_LIMITS.maxToolSteps; step += 1) {
        const response = await this.client.chat(this.conversation.toProviderMessages());
        if (!response.ok) {
          this.emit({ type: 'error', message: response.error.message });
          return;
        }

        this.conversation.addAssistant(response.rawAssistant);
        if (response.text) this.emit({ type: 'assistant_text', text: redactInternalIds(response.text) });

        if (response.toolCalls.length === 0) return;

        const calls = response.toolCalls;
        for (let index = 0; index < calls.length; index += 1) {
          const call = calls[index];
          const evaluation = await this.evaluateCall(call);

          if (evaluation.kind === 'error') {
            this.audit.record({
              userId: this.user.uid,
              tool: call.name,
              risk: getToolDefinition(call.name)?.risk ?? 'destructive',
              approvalRequired: false,
              workspaceId: asString(call.arguments, 'workspaceId') || undefined,
              resourceIds: [],
              affectedCount: 0,
              outcome: 'denied',
              detail: evaluation.message,
            });
            this.conversation.addToolResult(
              call.id,
              call.name,
              JSON.stringify({ error: evaluation.message }),
            );
            continue;
          }

          if (evaluation.kind === 'approval') {
            // Close the turn for any later calls so the transcript stays valid.
            for (let later = index + 1; later < calls.length; later += 1) {
              this.conversation.addToolResult(
                calls[later].id,
                calls[later].name,
                JSON.stringify({ status: 'deferred', reason: 'Awaiting a decision on an earlier action in this turn.' }),
              );
            }
            this.pending = { call, approval: evaluation.approval, risk: evaluation.risk };
            this.emit({ type: 'approval_required', approval: evaluation.approval });
            return;
          }

          const signature = canonicalKey(call.name, call.arguments);
          const repeats = attempted.get(signature) ?? 0;
          if (repeats >= 1) {
            // The same tool, with identical arguments, has already run this
            // turn. Refuse to repeat it, and give up if the model insists.
            this.conversation.addToolResult(
              call.id,
              call.name,
              JSON.stringify({
                error:
                  'This exact action was already attempted in this turn; it will not be run again. Do not repeat it — use the earlier result or try a different approach.',
              }),
            );
            attempted.set(signature, repeats + 1);
            if (repeats >= 2) {
              this.emit({
                type: 'error',
                message: 'I stopped because I kept repeating the same action without making progress.',
              });
              return;
            }
            continue;
          }
          attempted.set(signature, repeats + 1);

          const result = await this.runExecutor(call);
          this.conversation.addToolResult(call.id, call.name, JSON.stringify(result));
        }
      }

      this.emit({ type: 'error', message: 'I reached the maximum number of steps for one request.' });
    } finally {
      this.busy = false;
      this.emit({ type: 'done' });
    }
  }

  private async evaluateCall(call: ProposedToolCall): Promise<CallEvaluation> {
    if (call.parseError) return { kind: 'error', message: 'The action arguments were not valid JSON.' };

    const definition = getToolDefinition(call.name);
    if (!definition) return { kind: 'error', message: 'That action is not available.' };

    const validation = validateArguments(definition.parameters, call.arguments);
    if (!validation.ok) {
      return { kind: 'error', message: `The action arguments were invalid: ${validation.errors.join('; ')}` };
    }

    // Authorize before anything else, resolving the caller's real role rather
    // than trusting an id the model supplied.
    const workspaceId = asString(call.arguments, 'workspaceId');
    let role: WorkspaceRole | null = null;
    if (workspaceId) {
      const access = await resolveWorkspaceAccess(workspaceId, this.user.uid);
      if (!access.ok) return { kind: 'error', message: access.reason };
      role = access.role;
    }
    const authorization = authorizeTool(call.name, role);
    if (!authorization.allowed) {
      return { kind: 'error', message: authorization.reason ?? 'That action is not available.' };
    }

    const affectedCount = affectedCountFor(call.name, call.arguments);
    const risk = assessRisk(call.name, affectedCount);
    if (!risk.requiresApproval) return { kind: 'execute', risk };

    const plan = await buildApprovalAction(call.name, call.arguments, this.user);
    if ('error' in plan) return { kind: 'error', message: plan.error };

    const approval = this.approvals.create(this.user.uid, plan.action);
    this.audit.record({
      userId: this.user.uid,
      tool: call.name,
      risk: plan.action.risk,
      approvalRequired: true,
      approvalId: approval.id,
      workspaceId: plan.action.workspaceId ?? undefined,
      resourceIds: plan.action.resourceIds,
      affectedCount: plan.action.affectedCount,
      outcome: 'pending_approval',
    });
    return { kind: 'approval', approval, risk };
  }

  private async runExecutor(call: ProposedToolCall): Promise<unknown> {
    const definition = getToolDefinition(call.name);
    const risk = definition?.risk ?? 'destructive';
    const workspaceId = asString(call.arguments, 'workspaceId') || undefined;

    this.emit({ type: 'tool_activity', name: call.name, phase: 'start' });

    const ctx: ToolExecutionContext = { user: this.user, now: this.now() };
    let result;
    try {
      result = await executeTool(call.name, call.arguments, ctx);
    } catch (error) {
      result = {
        ok: false,
        summary: error instanceof Error ? error.message : 'The action failed.',
        error: 'The action failed.',
      };
    }

    const outcome: AuditOutcome = result.ok ? 'success' : 'failed';
    this.audit.record({
      userId: this.user.uid,
      tool: call.name,
      risk,
      approvalRequired: risk === 'destructive',
      workspaceId,
      resourceIds: extractResourceIds(call.arguments),
      affectedCount: affectedCountFor(call.name, call.arguments),
      outcome,
      detail: result.summary,
    });

    this.emit({
      type: 'tool_activity',
      name: call.name,
      phase: result.ok ? 'ok' : 'error',
      detail: result.summary,
    });

    return result.ok ? { ok: true, summary: result.summary, data: result.data } : { ok: false, error: result.error };
  }

  private emit(event: MarkEvent): void {
    this.onEvent(event);
  }

  /**
   * Prefix the outbound turn with the current context ids.
   *
   * Kept out of the visible bubble: the UI shows the user's own words, while the
   * model receives the ids it would otherwise have to ask for. These are hints,
   * not authority — the executors validate every id against Firestore.
   */
  private withContext(text: string): string {
    const parts: string[] = [];
    if (this.context.workspaceId) parts.push(`workspaceId=${this.context.workspaceId}`);
    if (this.context.boardId) parts.push(`boardId=${this.context.boardId}`);
    if (this.context.taskId) parts.push(`taskId=${this.context.taskId}`);
    if (parts.length === 0) return text;
    return `[Current context — ${parts.join(', ')}]\n\n${text}`;
  }
}

function extractResourceIds(args: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const key of ['taskId', 'boardId', 'workspaceId', 'commentId', 'linkId']) {
    const value = args[key];
    if (typeof value === 'string' && value) ids.push(value);
  }
  const bulk = args.taskIds;
  if (Array.isArray(bulk)) ids.push(...bulk.filter((entry): entry is string => typeof entry === 'string'));
  return ids.slice(0, 100);
}

const CONTEXT_ECHO = /\[Current context[^\]]*\]/gi;
const ID_TOKEN = /\b(workspace|board|task|comment|link)\s*id\s*[=:]\s*["'`]?[A-Za-z0-9_-]{1,64}["'`]?/gi;

/**
 * Strip internal identifiers from text shown to the user.
 *
 * The model is told to speak in names, and the current-context hint is injected
 * only into the provider transcript. This is the belt-and-braces pass that keeps
 * an echoed id (or the context line itself) out of the visible bubble.
 */
export function redactInternalIds(text: string): string {
  return text
    .replace(CONTEXT_ECHO, '')
    .replace(ID_TOKEN, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
