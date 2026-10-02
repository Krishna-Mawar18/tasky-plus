import { db } from './firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  serverTimestamp,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { TaskComment } from '@/types';

/**
 * Comments live at `tasks/{taskId}/comments/{commentId}`.
 *
 * A subcollection, never an array on the task document: a task with a long
 * discussion would otherwise grow past Firestore's 1 MB document limit, and
 * opening a task would download the whole history to show the first screen.
 */

/** Comments fetched per page. The brief asks for roughly 20–30. */
export const COMMENT_PAGE_SIZE = 25;

/** Guard against a runaway composer writing an unbounded document. */
export const MAX_COMMENT_LENGTH = 2000;

export type CommentErrorCode =
  | 'not-signed-in'
  | 'firebase-not-configured'
  | 'insufficient-permission'
  | 'comment-empty'
  | 'comment-too-long'
  | 'not-found'
  | 'storage-unavailable'
  | 'unknown';

/**
 * Typed comment failures, following the `memberErrors.ts` pattern: a closed set
 * of reasons the UI can turn into an accurate message instead of "something
 * went wrong".
 */
export class CommentOperationError extends Error {
  readonly code: CommentErrorCode;

  constructor(code: CommentErrorCode) {
    super(commentErrorMessages[code]);
    this.name = 'CommentOperationError';
    this.code = code;
  }
}

const commentErrorMessages: Record<CommentErrorCode, string> = {
  'not-signed-in': 'You need to be signed in to comment.',
  'firebase-not-configured': 'Firebase is not configured.',
  'insufficient-permission': 'Your role does not allow this action.',
  'comment-empty': 'Write something before posting.',
  'comment-too-long': `A comment can be at most ${MAX_COMMENT_LENGTH} characters.`,
  'not-found': 'That comment no longer exists.',
  'storage-unavailable': 'Comments are unavailable right now.',
  unknown: 'Something went wrong. Please try again.',
};

export function describeCommentError(error: unknown): string {
  if (error instanceof CommentOperationError) return error.message;
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return commentErrorMessages['insufficient-permission'];
  if (code === 'unauthenticated') return commentErrorMessages['not-signed-in'];
  return commentErrorMessages.unknown;
}

/**
 * Translate a raw Firestore failure into a typed comment error.
 *
 * The SDK's `permission-denied` message ("Missing or insufficient permissions")
 * is meant for a developer looking at a rules file, not for somebody who just
 * pressed Comment. Any code other than the two known auth failures is rethrown
 * untouched so a genuine bug is not disguised as a permissions problem.
 */
function rethrowCommentError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') throw new CommentOperationError('insufficient-permission');
  if (code === 'unauthenticated') throw new CommentOperationError('not-signed-in');
  throw error;
}

/** One page of comments, plus the cursor needed to ask for the page before it. */
export interface CommentPage {
  comments: TaskComment[];
  /** `true` when the server returned a full page, so an older page may exist. */
  hasMore: boolean;
  /** Pass back to fetch the previous (older) page. `null` after the first page. */
  cursor: QueryDocumentSnapshot | null;
}

function commentsRef(taskId: string) {
  return collection(db!, 'tasks', taskId, 'comments');
}

function toComment(snapshot: {
  id: string;
  data: () => Record<string, unknown>;
}): TaskComment {
  const data = snapshot.data();
  const createdAt = toNullableDate(data.createdAt);
  const updatedAt = toNullableDate(data.updatedAt);

  return {
    id: snapshot.id,
    authorId: String(data.authorId ?? ''),
    authorName: String(data.authorName ?? 'Unknown user'),
    authorPhotoURL: (data.authorPhotoURL as string | null) ?? null,
    content: String(data.content ?? ''),
    createdAt,
    // A comment that has never been edited carries no separate `updatedAt`.
    // Equalising them here is what lets the UI say "Edited" only when it is true
    // without comparing two nullable timestamps everywhere.
    updatedAt: createdAt ? updatedAt ?? createdAt : null,
  };
}

/**
 * `null` rather than the epoch for a missing timestamp.
 *
 * `serverTimestamp` leaves the field unresolved on a local write, so a comment
 * that was just posted genuinely has no `createdAt` for a moment. Rendering the
 * epoch ("Jan 1, 1970") there would be a lie.
 */
function toNullableDate(value: unknown): Date | null {
  return typeof (value as { toDate?: () => Date })?.toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : null;
}

/**
 * One page of comments, newest first, walking backwards in time.
 *
 * The query is `orderBy('createdAt', 'desc')` with a hard `limit`, and older
 * pages start after the last document of the previous one. Nothing is fetched
 * in full and sliced in React, so a task with thousands of comments still costs
 * `COMMENT_PAGE_SIZE` reads to open.
 *
 * The single-field `createdAt` index Firestore maintains automatically is all
 * this needs — there is no composite index for comments.
 */
export async function fetchCommentPage(
  taskId: string,
  options: { cursor?: QueryDocumentSnapshot | null; limit?: number } = {},
): Promise<CommentPage> {
  if (!db) throw new CommentOperationError('firebase-not-configured');

  const pageSize = Math.max(1, options.limit ?? COMMENT_PAGE_SIZE);
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (options.cursor) constraints.push(startAfter(options.cursor));

  const snapshot = await getDocs(query(commentsRef(taskId), ...constraints));
  const documents = snapshot.docs;

  return {
    comments: documents.map(toComment),
    hasMore: documents.length === pageSize,
    cursor: documents.length > 0 ? documents[documents.length - 1] : options.cursor ?? null,
  };
}

export const commentService = {
  /** Total comments on a task, for the section heading. Capped by the rules. */
  async getCount(taskId: string): Promise<number> {
    if (!db) return 0;
    try {
      const snapshot = await getDocs(query(commentsRef(taskId), limit(1000)));
      return snapshot.size;
    } catch (error) {
      console.error('Error counting comments:', error);
      return 0;
    }
  },

  /**
   * Post a comment.
   *
   * The author fields are denormalised onto the document for the same reason
   * they are on a membership record: the rules refuse cross-user profile reads,
   * so a list of comments could not otherwise show who wrote what.
   */
  async addComment(input: {
    taskId: string;
    authorId: string;
    authorName: string;
    authorPhotoURL: string | null;
    content: string;
  }): Promise<string> {
    if (!db) throw new CommentOperationError('firebase-not-configured');

    const content = input.content.trim();
    if (!content) throw new CommentOperationError('comment-empty');
    if (content.length > MAX_COMMENT_LENGTH) throw new CommentOperationError('comment-too-long');

    try {
      const created = await addDoc(commentsRef(input.taskId), {
        uid: input.authorId,
        authorId: input.authorId,
        authorName: input.authorName || 'Unknown user',
        authorPhotoURL: input.authorPhotoURL ?? null,
        content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return created.id;
    } catch (error) {
      rethrowCommentError(error);
    }
  },

  /**
   * Edit a comment's text.
   *
   * Only `content` and `updatedAt` are written. The rules enforce the same
   * restriction, so an edited comment cannot also quietly change its author.
   */
  async updateComment(input: { taskId: string; commentId: string; content: string }): Promise<void> {
    if (!db) throw new CommentOperationError('firebase-not-configured');

    const content = input.content.trim();
    if (!content) throw new CommentOperationError('comment-empty');
    if (content.length > MAX_COMMENT_LENGTH) throw new CommentOperationError('comment-too-long');

    try {
      await updateDoc(doc(db, 'tasks', input.taskId, 'comments', input.commentId), {
        content,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      rethrowCommentError(error);
    }
  },

  /**
   * Remove a comment.
   *
   * Owners may remove anybody's; managers and viewers only their own. The rules
   * are what actually decide — this method simply reports the refusal.
   */
  async deleteComment(input: { taskId: string; commentId: string }): Promise<void> {
    if (!db) throw new CommentOperationError('firebase-not-configured');
    try {
      await deleteDoc(doc(db, 'tasks', input.taskId, 'comments', input.commentId));
    } catch (error) {
      rethrowCommentError(error);
    }
  },
};