import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'node:crypto';

/**
 * Server-only Firebase ID-token verification.
 *
 * This exists so `/api/mark` can refuse anonymous traffic without pulling in
 * `firebase-admin` or a service account. It checks the RS256 signature against
 * Google's published public certificates and validates the standard Firebase
 * claims. It never needs a secret, and it never reads or writes Firestore.
 *
 * It is a gate on *who may spend provider tokens*, not the authority on what
 * data they may touch: every Firestore read/write still runs under the caller's
 * own Firebase session and is enforced by `firestore.rules`.
 */

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const CLOCK_SKEW_SECONDS = 60;

export interface VerifiedToken {
  uid: string;
  email?: string;
}

interface CachedCerts {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CachedCerts | null = null;

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(base64UrlToBuffer(segment).toString('utf8')) as T;
}

async function getCertificates(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;

  const response = await fetch(CERT_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not fetch Firebase signing certificates');
  }

  const certs = (await response.json()) as Record<string, string>;

  let maxAgeMs = 600_000;
  const cacheControl = response.headers.get('cache-control') ?? '';
  const match = /max-age=(\d+)/.exec(cacheControl);
  if (match) maxAgeMs = Number(match[1]) * 1000;

  certCache = { certs, expiresAt: now + maxAgeMs };
  return certs;
}

function resolveProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase project id is not configured');
  return projectId;
}

/** Verify an `Authorization: Bearer <idToken>` value. Throws on any failure. */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedToken> {
  const projectId = resolveProjectId();
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment<{ alg?: string; kid?: string }>(encodedHeader);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported token algorithm');

  const certs = await getCertificates();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown token signing key');

  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey(cert);
  } catch {
    throw new Error('Invalid signing certificate');
  }

  const signedData = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const valid = cryptoVerify('RSA-SHA256', signedData, publicKey, base64UrlToBuffer(encodedSignature));
  if (!valid) throw new Error('Bad token signature');

  const payload = decodeJsonSegment<{
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
  }>(encodedPayload);

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch');
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new Error('Token expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error('Token issued in the future');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('Token has no subject');

  return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}
