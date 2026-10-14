'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Send,
  ShieldAlert,
  X,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createMarkClient } from '@/mark/client';
import { MarkAgent, type MarkEvent } from '@/mark/orchestrator';
import type { ApprovalRequest } from '@/mark/policy/approvals';
import { Markdown } from '@/components/task/Markdown';
import { boardService, workspaceService } from '@/lib/services';
import type { Board, Workspace } from '@/types';

type TimelineItem =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string }
  | { id: number; kind: 'tool'; name: string; phase: 'start' | 'ok' | 'error'; detail?: string }
  | { id: number; kind: 'error'; text: string };

type NewTimelineItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; phase: 'start' | 'ok' | 'error'; detail?: string }
  | { kind: 'error'; text: string };

/** Turn an internal tool name (`create_task`) into a readable label (`Create task`). */
function toolLabel(name: string): string {
  const label = name.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function MarkPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const uid = user?.uid ?? null;
  const userRef = useRef(user);
  userRef.current = user;

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [pending, setPending] = useState<ApprovalRequest | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const initialWorkspaceId = searchParams.get('workspaceId') ?? '';
  const initialBoardId = searchParams.get('boardId') ?? '';
  const initialTaskId = searchParams.get('taskId') ?? '';

  const [ctxWorkspaceId, setCtxWorkspaceId] = useState(initialWorkspaceId);
  const [ctxBoardId, setCtxBoardId] = useState(initialBoardId);
  const [ctxTaskId, setCtxTaskId] = useState(initialTaskId);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);

  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((item: NewTimelineItem) => {
    idRef.current += 1;
    setItems((prev) => [...prev, { ...item, id: idRef.current } as TimelineItem]);
  }, []);

  const handleEvent = useCallback(
    (event: MarkEvent) => {
      switch (event.type) {
        case 'user_message':
          push({ kind: 'user', text: event.text });
          break;
        case 'assistant_text':
          push({ kind: 'assistant', text: event.text });
          break;
        case 'tool_activity':
          push({ kind: 'tool', name: event.name, phase: event.phase, detail: event.detail });
          break;
        case 'approval_required':
          setPending(event.approval);
          setBusy(false);
          break;
        case 'approval_resolved':
          setPending(null);
          break;
        case 'error':
          push({ kind: 'error', text: event.message });
          break;
        case 'done':
          setBusy(false);
          break;
      }
    },
    [push],
  );

  const client = useMemo(
    () =>
      createMarkClient(async () => {
        const account = userRef.current;
        return account ? account.getIdToken() : null;
      }),
    [],
  );

  const agent = useMemo(() => {
    const account = userRef.current;
    if (!account) return null;
    return new MarkAgent({
      user: { uid: account.uid, displayName: account.displayName, email: account.email },
      client,
      onEvent: handleEvent,
    });
    // A new signed-in user starts a fresh session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, client]);

  // Redirect unauthenticated visitors to the landing page.
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [loading, user, router]);

  // Keep the agent's context in step with the switcher.
  useEffect(() => {
    agent?.setContext({
      workspaceId: ctxWorkspaceId || undefined,
      boardId: ctxBoardId || undefined,
      taskId: ctxTaskId || undefined,
    });
  }, [agent, ctxWorkspaceId, ctxBoardId, ctxTaskId]);

  useEffect(() => {
    if (!user) return;
    workspaceService
      .getWorkspaces(user.uid)
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, [user]);

  useEffect(() => {
    if (!ctxWorkspaceId) {
      setBoards([]);
      setCtxBoardId('');
      return;
    }
    boardService
      .getBoards(ctxWorkspaceId)
      .then((next) => {
        setBoards(next);
        setCtxBoardId((current) => (next.some((board) => board.id === current) ? current : ''));
      })
      .catch(() => setBoards([]));
  }, [ctxWorkspaceId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, pending]);

  const handleSend = useCallback(async () => {
    if (!agent || busy) return;
    const text = input.trim();
    if (!text) return;
    setInput('');
    setBusy(true);
    await agent.send(text);
  }, [agent, busy, input]);

  const handleApprove = useCallback(async () => {
    if (!agent || !pending) return;
    setBusy(true);
    await agent.approve(pending.id);
  }, [agent, pending]);

  const handleCancel = useCallback(async () => {
    if (!agent || !pending) return;
    setBusy(true);
    await agent.cancel(pending.id);
  }, [agent, pending]);

  const handleReset = useCallback(() => {
    agent?.reset();
    setItems([]);
    setPending(null);
    setBusy(false);
  }, [agent]);

  // Return to wherever Mark was opened from; fall back to the dashboard when
  // there is no in-app history (for example a bookmarked /mark visit).

  const contextLabel = useMemo(() => {
    const workspace = workspaces.find((candidate) => candidate.id === ctxWorkspaceId);
    const board = boards.find((candidate) => candidate.id === ctxBoardId);
    return {
      workspace: workspace?.name ?? null,
      board: board?.name ?? null,
    };
  }, [workspaces, boards, ctxWorkspaceId, ctxBoardId]);

  if (loading || !user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#FCFBF6]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#111827]" />
          <div className="animate-pulse font-mono text-xl text-[#111827]">Loading Mark…</div>
        </div>
      </div>
    );
  }

  const canSend = !busy && !pending && input.trim().length > 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#FCFBF6] text-[#111827]">
      {/* Header */}
      <header className="z-20 border-b border-[#D7DCE3] bg-white">
        <div className="flex h-16 items-center gap-3 px-4 sm:h-[72px] sm:px-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="group relative overflow-hidden flex items-center justify-center px-2 py-2 sm:px-3 sm:py-3 bg-white/80 hover:bg-black text-gray-800 hover:text-white rounded-xl sm:rounded-2xl transition-all duration-500 hover:scale-110 hover:shadow-2xl border border-gray-300 hover:border-black backdrop-blur-md hover:backdrop-blur-xl flex-shrink-0"
          >
          {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl sm:rounded-2xl"></div>
                
            {/* Content */}
            <div className="relative z-10 flex items-center justify-center space-x-1 sm:space-x-2">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:scale-110" />
              <span className="font-mono font-bold text-xs sm:text-sm opacity-0 sm:group-hover:opacity-100 transition-all duration-300 delay-100 transform translate-x-2 group-hover:translate-x-0 hidden sm:inline">
                Dashboard
              </span>
            </div>
                
            {/* Shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            </div>
          </button>

          <Image src="/mark.svg" alt="Mark Logo" width={40} height={40} className="bg-transparent transition-transform rounded-full duration-300 shadow-xl" />

          <h1 className="font-mono text-xl font-extrabold tracking-tight text-[#111827]">Mark</h1>

          <div className="ml-auto flex items-center gap-2">
            {/* Context switcher — desktop only; query params still carry context on mobile. */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative">
                <label htmlFor="mark-context-workspace" className="sr-only">
                  Workspace context
                </label>
                <select
                  id="mark-context-workspace"
                  value={ctxWorkspaceId}
                  onChange={(event) => setCtxWorkspaceId(event.target.value)}
                  className="appearance-none rounded-[10px] border border-[#D7DCE3] bg-white py-2 pl-3 pr-8 font-mono text-xs text-[#111827] transition-colors focus-visible:border-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF]"
                >
                  <option value="">No workspace</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                  aria-hidden="true"
                />
              </div>
              <div className="relative">
                <label htmlFor="mark-context-board" className="sr-only">
                  Board context
                </label>
                <select
                  id="mark-context-board"
                  value={ctxBoardId}
                  onChange={(event) => setCtxBoardId(event.target.value)}
                  disabled={!ctxWorkspaceId}
                  className="appearance-none rounded-[10px] border border-[#D7DCE3] bg-white py-2 pl-3 pr-8 font-mono text-xs text-[#111827] transition-colors focus-visible:border-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] disabled:opacity-50"
                >
                  <option value="">No board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                  aria-hidden="true"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              aria-label="Start a new chat"
              title="Refresh chat"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border-2 border-black bg-black text-white transition-colors hover:bg-white hover:text-[#050505] hover:border-2 hover:border-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Active context hint (includes task chip) */}
        {(ctxTaskId || contextLabel.workspace || contextLabel.board) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#EDEFF2] px-4 py-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
              Context
            </span>
            {(contextLabel.workspace || contextLabel.board) && (
              <span className="font-mono text-xs text-[#64748B]">
                {contextLabel.workspace ?? 'Workspace'}
                {contextLabel.board ? ` › ${contextLabel.board}` : ''}
              </span>
            )}
            {ctxTaskId && (
              <button
                type="button"
                onClick={() => setCtxTaskId('')}
                aria-label="Clear task context"
                className="flex items-center gap-1 rounded-full border-2 border-black bg-black text-white transition-colors hover:bg-white hover:text-[#050505] hover:border-2 hover:border-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF]"
              >
                task context
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Conversation */}
      <main
        className="flex-1 overflow-y-auto"
        aria-label="Conversation with Mark"
        aria-live="polite"
        aria-busy={busy}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[700px] flex-col px-4 pb-8 pt-6 sm:px-6">
          {items.length === 0 && !pending ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Image
                src="/mark.svg"
                alt=""
                width={56}
                height={56}
                aria-hidden="true"
                className="mb-4 h-14 w-14 rounded-full"
              />
              <h2 className="mb-2 font-mono text-lg font-bold text-[#111827]">Hi, I&apos;m Mark.</h2>
              <p className="max-w-md font-mono text-sm leading-relaxed text-[#64748B]">
                I can search and summarise your Tasky work, and — with your approval — create, update,
                move, archive or delete tasks, boards and comments. What would you like to do?
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {items.map((item) => (
                <TimelineRow key={item.id} item={item} />
              ))}

              {busy && !pending && (
                <div className="flex items-center gap-2 font-mono text-xs text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mark is working…
                </div>
              )}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="z-20 bg-[#FCFBF6] pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-[700px] px-4 sm:px-6">
          <div className="flex items-end gap-2">
            <label htmlFor="mark-composer" className="sr-only">
              Message Mark
            </label>
            <textarea
              id="mark-composer"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder="Ask Mark something..."
              disabled={busy || !!pending}
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[12px] border-2 border-[#111827] bg-white px-4 py-2.5 font-mono text-sm leading-6 text-[#111827] placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label={busy ? 'Sending' : 'Send message'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] focus-visible:ring-offset-2 ${
                canSend
                  ? 'bg-[#050505] text-white hover:bg-white hover:text-[#050505] hover:border-2 hover:border-[#050505]'
                  : 'cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]'
              }`}
            >
              {busy && !pending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {pending && (
        <ApprovalDialog approval={pending} onApprove={handleApprove} onCancel={handleCancel} busy={busy} />
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  if (item.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] bg-[#050505] px-4 py-2.5 font-mono text-sm leading-relaxed text-white sm:max-w-[75%]">
          {item.text}
        </div>
      </div>
    );
  }

  if (item.kind === 'assistant') {
    return (
      <div className="flex items-start gap-2.5">
        <Image
          src="/mark.svg"
          alt="Mark"
          width={28}
          height={28}
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
        />
        <div className="max-w-[85%] break-words rounded-[16px] border border-[#D7DCE3] bg-white px-4 py-2.5 font-mono text-sm leading-relaxed text-[#111827]">
          <Markdown content={item.text} className="text-[#111827]" />
        </div>
      </div>
    );
  }

  if (item.kind === 'error') {
    return (
      <div className="flex items-start gap-2.5">
        <Image
          src="/mark.svg"
          alt=""
          width={28}
          height={28}
          aria-hidden="true"
          className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
        />
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] border border-[#FFC9C5] bg-[#FFF3F2] px-4 py-2.5">
          <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wide text-[#B42318]">
            Error
          </span>
          <p className="font-mono text-sm leading-relaxed text-[#7A271A]">{item.text}</p>
        </div>
      </div>
    );
  }

  // tool activity
  const tone =
    item.phase === 'error'
      ? 'border-[#FFC9C5] bg-[#FFF3F2] text-[#7A271A]'
      : item.phase === 'ok'
        ? 'border-[#D7DCE3] bg-white text-[#374151]'
        : 'border-[#D7DCE3] bg-white text-[#64748B]';

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 shrink-0" aria-hidden="true" />
      <div className={`flex max-w-[85%] items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 font-mono text-xs ${tone}`}>
        {item.phase === 'start' ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : item.phase === 'ok' ? (
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="font-bold">{toolLabel(item.name)}</span>
        {item.detail && <span className="truncate text-[#64748B]">{item.detail}</span>}
      </div>
    </div>
  );
}

function ApprovalDialog({
  approval,
  onApprove,
  onCancel,
  busy,
}: {
  approval: ApprovalRequest;
  onApprove: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { action } = approval;
  const destructive = action.risk === 'destructive';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-approval-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#D7DCE3] bg-white shadow-2xl"
      >
        <div className={`flex items-center gap-3 px-5 py-4 ${destructive ? 'bg-[#FFF3F2]' : 'bg-amber-50'}`}>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              destructive ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            <ShieldAlert className={`h-5 w-5 ${destructive ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h3 id="mark-approval-title" className="font-mono text-sm font-bold text-[#111827]">
              {destructive ? 'Destructive action needs approval' : 'Confirm this action'}
            </h3>
            <p className="font-mono text-xs text-[#64748B]">Mark will not proceed until you approve.</p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wide text-[#64748B]">Action</p>
            <p className="font-mono text-sm text-[#111827]">{action.toolName}</p>
          </div>

          {action.preview.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wide text-[#64748B]">
                Will affect ({action.affectedCount})
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#D7DCE3] bg-[#F8F8F6] p-3">
                {action.preview.map((line, index) => (
                  <li key={index} className="font-mono text-xs text-[#374151]">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {action.consequences.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wide text-[#64748B]">
                Consequences
              </p>
              <ul className="space-y-1">
                {action.consequences.map((line, index) => (
                  <li key={index} className="font-mono text-xs text-[#B42318]">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#D7DCE3] bg-[#F8F8F6] px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#D7DCE3] bg-white px-4 py-2 font-mono text-sm font-bold text-[#374151] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFEAFF] disabled:opacity-50 ${
              destructive ? 'bg-red-600' : 'bg-[#050505]'
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {destructive ? 'Delete / proceed' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#FCFBF6]">
          <div className="font-mono text-lg text-[#111827]">Loading Mark…</div>
        </div>
      }
    >
      <MarkPageInner />
    </Suspense>
  );
}
