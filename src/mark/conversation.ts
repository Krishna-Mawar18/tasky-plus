import type { ProviderMessage } from './types';

export interface FocusContext {
  workspaceId?: string;
  boardId?: string;
  taskId?: string;
}

export type ShownResourceKind = 'workspace' | 'board' | 'task' | 'comment' | 'link' | 'member';

export interface ShownResource {
  kind: ShownResourceKind;
  id: string;
  name: string;
}

const MAX_TRANSCRIPT_MESSAGES = 80;

/**
 * Short-term conversation state.
 *
 * Holds the transcript sent to the provider, the focused workspace/board/task,
 * and the ordered list of resources most recently shown. Memory here is a hint
 * only: it is never authoritative Tasky state. Before any mutation the
 * orchestrator re-resolves the target against Firestore.
 */
export class Conversation {
  private messages: ProviderMessage[] = [];
  private shown: ShownResource[] = [];

  focus: FocusContext = {};

  addUser(text: string): void {
    this.messages.push({ role: 'user', content: text });
    this.trim();
  }

  addAssistant(message: ProviderMessage): void {
    this.messages.push(message);
    this.trim();
  }

  addToolResult(toolCallId: string, name: string, content: string): void {
    this.messages.push({ role: 'tool', tool_call_id: toolCallId, name, content });
    this.trim();
  }

  toProviderMessages(): ProviderMessage[] {
    return [...this.messages];
  }

  setShown(resources: ShownResource[]): void {
    this.shown = resources.slice(0, 50);
  }

  getShown(): ShownResource[] {
    return [...this.shown];
  }

  reset(): void {
    this.messages = [];
    this.shown = [];
    this.focus = {};
  }

  /** Keep only the most recent turns so the transcript cannot grow without bound. */
  private trim(): void {
    if (this.messages.length > MAX_TRANSCRIPT_MESSAGES) {
      this.messages = this.messages.slice(this.messages.length - MAX_TRANSCRIPT_MESSAGES);
    }
  }
}
