import type { VerifiedToken } from '@/mark/providers/verifyToken';
import { verifyFirebaseIdToken } from '@/mark/providers/verifyToken';

export type AuthResult = { ok: true; token: VerifiedToken } | { ok: false };

/**
 * Server-only. Resolve the caller from the `Authorization: Bearer <idToken>`
 * header. The identity is taken from the verified token, never from the request
 * body, so a caller cannot claim to be somebody else.
 */
export async function verifyBearerToken(request: Request): Promise<AuthResult> {
  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return { ok: false };

  const idToken = header.slice('bearer '.length).trim();
  if (!idToken) return { ok: false };

  try {
    const token = await verifyFirebaseIdToken(idToken);
    return { ok: true, token };
  } catch (error) {
    // Never echo the reason to the caller: whether a token is expired, malformed
    // or signed by the wrong key is not the browser's business.
    console.warn('Mark token verification failed:', (error as Error).message);
    return { ok: false };
  }
}
