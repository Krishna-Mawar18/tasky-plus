import { db } from './firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { TaskLink } from '@/types';
import {
  linkDuplicateKey,
  validateLinkTitle,
  validateLinkUrl,
  type LinkTitleRejectionReason,
  type LinkUrlRejectionReason,
} from './linkValidation';

/**
 * Links live at `tasks/{taskId}/links/{linkId}`.
 *
 * A subcollection, never an array on the task document. Authorization follows
 * the parent task in `firestore.rules`; this module only writes fields the
 * rules permit and translates a refusal into something a person can read.
 */

export type LinkErrorCode =
  | 'not-signed-in'
  | 'firebase-not-configured'
  | 'insufficient-permission'
  | 'invalid-title'
  | 'invalid-url'
  | 'duplicate-url'
  | 'not-found'
  | 'unknown';

/** A refusal the UI can explain, carrying the specific field reason. */
export class LinkOperationError extends Error {
  readonly code: LinkErrorCode;
  readonly reason: LinkUrlRejectionReason | LinkTitleRejectionReason | null;

  constructor(
    code: LinkErrorCode,
    message?: string,
    reason: LinkUrlRejectionReason | LinkTitleRejectionReason | null = null,
  ) {
    super(message ?? linkErrorMessages[code]);
    this.name = 'LinkOperationError';
    this.code = code;
    this.reason = reason;
  }
}

const linkErrorMessages: Record<LinkErrorCode, string> = {
  'not-signed-in': 'You need to be signed in to manage links.',
  'firebase-not-configured': 'Firebase is not configured.',
  'insufficient-permission': 'Your role does not allow this action.',
  'invalid-title': 'That link title is not valid.',
  'invalid-url': 'That URL is not valid.',
  'duplicate-url': 'That link is already attached to this task.',
  'not-found': 'That link no longer exists.',
  unknown: 'Something went wrong. Please try again.',
};

export function describeLinkError(error: unknown): string {
  if (error instanceof LinkOperationError) return error.message;

  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return linkErrorMessages['insufficient-permission'];
  if (code === 'unauthenticated') return linkErrorMessages['not-signed-in'];
  if (code === 'not-found') return linkErrorMessages['not-found'];
  return linkErrorMessages.unknown;
}

/**
 * Translate a raw Firestore failure into a typed link error.
 *
 * The SDK's `permission-denied` message is written for somebody reading a rules
 * file, not for somebody who just pressed Add Link. Anything else is rethrown
 * untouched so a genuine bug is not disguised as a permissions problem.
 */
function rethrowLinkError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') throw new LinkOperationError('insufficient-permission');
  if (code === 'unauthenticated') throw new LinkOperationError('not-signed-in');
  throw error;
}

function linksRef(taskId: string) {
  return collection(db!, 'tasks', taskId, 'links');
}

function toLink(snapshot: {
  id: string;
  data: () => Record<string, unknown>;
}): TaskLink {
  const data = snapshot.data();
  const createdAt = toNullableDate(data.createdAt);
  const updatedAt = toNullableDate(data.updatedAt);

  return {
    id: snapshot.id,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? 'Unknown user'),
    title: String(data.title ?? 'Untitled link'),
    url: String(data.url ?? ''),
    hostname: String(data.hostname ?? ''),
    createdAt,
    // Equalising the two timestamps here is what lets the UI show an edited
    // marker only when a link has genuinely changed, without comparing two
    // nullable dates everywhere.
    updatedAt: createdAt ? updatedAt ?? createdAt : null,
  };
}

/** `null` rather than the epoch for a timestamp the server has not resolved. */
function toNullableDate(value: unknown): Date | null {
  return typeof (value as { toDate?: () => Date })?.toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : null;
}

export const linkService = {
  /**
   * Every link on a task, newest first.
   *
   * The list is bounded by the per-task duplicate rule and the fact that a
   * person adds links one at a time, so there is no pagination yet. Should that
   * change, this is the one query to convert.
   */
  async getLinks(taskId: string): Promise<TaskLink[]> {
    if (!db) return [];
    try {
      const snapshot = await getDocs(query(linksRef(taskId), orderBy('createdAt', 'desc')));
      return snapshot.docs.map(toLink);
    } catch (error) {
      console.error('Error loading links:', error);
      throw error;
    }
  },

  /**
   * Reject a URL already used on this task.
   *
   * `excludeLinkId` is the link being edited, so a save that leaves the address
   * unchanged does not collide with itself.
   *
   * Note on concurrency: this is a preliminary read, not a transaction, so two
   * simultaneous adds of the same URL can still both pass it. The duplicate
   * rule is a convenience that keeps a task tidy, not a uniqueness guarantee;
   * the UI's disabled-while-busy state is what prevents the common double
   * submit. Making it truly atomic would need a deterministic document id or a
   * transaction, which the current single-URL-per-submission flow does not
   * justify.
   */
  async assertUrlAvailable(taskId: string, url: string, excludeLinkId?: string): Promise<void> {
    if (!db) throw new LinkOperationError('firebase-not-configured');

    const key = linkDuplicateKey(url);
    if (!key) throw new LinkOperationError('invalid-url');

    const existing = await this.getLinks(taskId);
    const conflict = existing.find(
      (link) => link.id !== excludeLinkId && linkDuplicateKey(link.url) === key,
    );

    if (conflict) {
      throw new LinkOperationError(
        'duplicate-url',
        `"${conflict.title}" already links to that address on this task.`,
      );
    }
  },

  /**
   * Validate, reject duplicates, then record a link.
   *
   * Only the creator's uid may be written: the rules independently require
   * `createdBy == request.auth.uid`, so a tampered client cannot attribute a
   * link to somebody else.
   */
  async addLink(input: {
    taskId: string;
    createdBy: string;
    createdByName: string;
    title: string;
    url: string;
  }): Promise<string> {
    if (!db) throw new LinkOperationError('firebase-not-configured');

    const title = input.title.trim();
    const titleValidation = validateLinkTitle(title);
    if (!titleValidation.valid) {
      throw new LinkOperationError('invalid-title', titleValidation.message, titleValidation.reason);
    }

    const urlValidation = validateLinkUrl(input.url);
    if (!urlValidation.valid || !urlValidation.normalized || !urlValidation.hostname) {
      throw new LinkOperationError('invalid-url', urlValidation.message, urlValidation.reason);
    }

    await this.assertUrlAvailable(input.taskId, urlValidation.normalized);

    try {
      const created = await addDoc(linksRef(input.taskId), {
        createdBy: input.createdBy,
        createdByName: input.createdByName || 'Unknown user',
        title,
        url: urlValidation.normalized,
        hostname: urlValidation.hostname,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return created.id;
    } catch (error) {
      rethrowLinkError(error);
    }
  },

  /**
   * Edit a link's title or address.
   *
   * Only `title`, `url`, `hostname` and `updatedAt` are written. `createdBy`
   * and `createdAt` are not touched, and the rules pin both so an edit can
   * never rewrite who added the link or when.
   */
  async updateLink(input: {
    taskId: string;
    linkId: string;
    title: string;
    url: string;
  }): Promise<void> {
    if (!db) throw new LinkOperationError('firebase-not-configured');

    const title = input.title.trim();
    const titleValidation = validateLinkTitle(title);
    if (!titleValidation.valid) {
      throw new LinkOperationError('invalid-title', titleValidation.message, titleValidation.reason);
    }

    const urlValidation = validateLinkUrl(input.url);
    if (!urlValidation.valid || !urlValidation.normalized || !urlValidation.hostname) {
      throw new LinkOperationError('invalid-url', urlValidation.message, urlValidation.reason);
    }

    await this.assertUrlAvailable(input.taskId, urlValidation.normalized, input.linkId);

    try {
      await updateDoc(doc(db, 'tasks', input.taskId, 'links', input.linkId), {
        title,
        url: urlValidation.normalized,
        hostname: urlValidation.hostname,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      rethrowLinkError(error);
    }
  },

  /**
   * Remove a link.
   *
   * Owners may remove anybody's; managers only their own. The rules are what
   * actually decide — this method simply reports the refusal.
   */
  async deleteLink(input: { taskId: string; linkId: string }): Promise<void> {
    if (!db) throw new LinkOperationError('firebase-not-configured');
    try {
      await deleteDoc(doc(db, 'tasks', input.taskId, 'links', input.linkId));
    } catch (error) {
      rethrowLinkError(error);
    }
  },
};
