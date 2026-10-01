import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserEmailIndexEntry } from '@/types';
import { MemberOperationError } from './memberErrors';

/**
 * Top-level collection that maps a normalised email to a user id.
 *
 * Members are added by email, but the browser client cannot list Firebase Auth
 * users. Each user therefore publishes their own address here on sign-in, and
 * the lookup is a point read on a SHA-256 digest so the raw address never
 * appears in a document id.
 *
 * Security rules restrict this collection to: `get` for any signed-in user,
 * `list` for nobody, and writes only to the entry belonging to the caller whose
 * `email` matches their own auth token.
 */
export const USER_EMAIL_INDEX_COLLECTION = 'userEmailIndex';

/** Canonical form used for both the digest and the stored `email` field. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lowercase hex SHA-256 of the normalised address. */
export async function hashEmail(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  // WebCrypto is only exposed in a secure context. On plain http (a LAN IP, for
  // example) it is simply missing, and the resulting TypeError used to surface
  // as nothing more than a console line while every lookup quietly failed.
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'This page is not a secure context, so the email lookup index cannot be written. ' +
        'Open the app over HTTPS or on localhost.',
    );
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function emailIndexRef(email: string) {
  return hashEmail(email).then((hash) => doc(db!, USER_EMAIL_INDEX_COLLECTION, hash));
}

/**
 * Resolve an email to a user profile, or `null` when nobody has published that
 * address yet.
 *
 * The stored `email` is re-checked against the query so a stale or hand-edited
 * index entry can never resolve to the wrong account.
 */
export async function lookupUserByEmail(email: string): Promise<UserEmailIndexEntry | null> {
  if (!db) throw new MemberOperationError('firebase-not-configured');

  const normalized = normalizeEmail(email);
  if (!normalized) throw new MemberOperationError('invalid-email');

  const ref = await emailIndexRef(normalized);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  if (normalizeEmail(String(data.email ?? '')) !== normalized) return null;

  return {
    uid: String(data.uid ?? snapshot.id),
    email: normalized,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

/**
 * Publish (or refresh) the signed-in user's own index entry.
 *
 * Called on every authenticated session so members added by email resolve even
 * if the account has never visited the workspace before.
 *
 * Returns `true` only when the entry was read back successfully, so the caller
 * can tell the difference between "published" and "the write was refused" —
 * which is the difference between a working lookup and a silent dead end.
 */
export async function upsertUserEmailIndex(profile: {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<boolean> {
  if (!db || !profile.email) return false;

  const normalized = normalizeEmail(profile.email);
  if (!normalized) return false;

  const ref = await emailIndexRef(normalized);
  await setDoc(
    ref,
    {
      uid: profile.uid,
      email: normalized,
      displayName: profile.displayName ?? null,
      photoURL: profile.photoURL ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const verified = await getDoc(ref);
  return verified.exists() && verified.data()?.uid === profile.uid;
}
