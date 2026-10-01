#!/usr/bin/env node
/**
 * Owner membership backfill — NOT RUN. Review before use.
 *
 * ---------------------------------------------------------------------------
 * What this does
 * ---------------------------------------------------------------------------
 * Workspaces created before memberships existed have no
 * `workspaces/{workspaceId}/members/{ownerId}` document. Security rules treat
 * the subcollection as the source of truth for roles, so those workspaces need
 * an owner membership before the new rules are deployed.
 *
 * This script creates exactly one document per workspace:
 *
 *   workspaces/{workspaceId}/members/{ownerId}   role: "owner"
 *
 * It never touches boards, tasks, workspaces, or any other member, and it never
 * migrates historic members of `workspaces.members` — that array is only a
 * derived UID list, and no role is inferred from it.
 *
 * ---------------------------------------------------------------------------
 * Why this exists when the app can repair itself
 * ---------------------------------------------------------------------------
 * The application also repairs this on the fly: an owner opening a workspace
 * whose owner membership is missing gets it created by
 * `memberService.ensureOwnerMembership`, which the rules permit for the
 * workspace owner and only for their own document. That is enough to make the
 * app work, and is the normal path.
 *
 * Use this script instead when you want the data complete up front, or for
 * workspaces whose owners will not open them before the rules are deployed.
 *
 * ---------------------------------------------------------------------------
 * Safety
 * ---------------------------------------------------------------------------
 * - Dry run by default. Pass `--apply` to write. Without it, nothing is sent.
 * - Writes are idempotent: an owner membership that already exists is skipped.
 * - Uses the Firestore REST API with your own OAuth access token, so no service
 *   account file, no `firebase-admin` dependency and no new npm package.
 * - Does not delete or modify any existing document.
 *
 * ---------------------------------------------------------------------------
 * Usage
 * ---------------------------------------------------------------------------
 * Get a token that can read and write Firestore in the project:
 *
 *   gcloud auth print-access-token
 *
 * or
 *
 *   firebase login:ci          # if already logged in
 *
 * Then:
 *
 *   # Windows PowerShell
 *   $env:FIREBASE_ACCESS_TOKEN = "<token>"
 *   $env:FIREBASE_PROJECT_ID   = "<project id>"
 *   node scripts/migrate-workspace-members.mjs
 *   node scripts/migrate-workspace-members.mjs --apply
 *
 * Options:
 *   --apply            Perform the writes. Omit for a dry run.
 *   --project <id>     Project id, if not set in FIREBASE_PROJECT_ID.
 *   --batch <n>        Documents to request per page (default 200, max 300).
 *
 * After the backfill, deploy the rules:
 *
 *   firebase deploy --only firestore:rules --project <project id>
 */

import process from 'node:process';

const FIRESTORE_SCOPE_HOST = 'https://firestore.googleapis.com';
const DEFAULT_DATABASE = '(default)';
const MAX_PAGE_SIZE = 300;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArgIndex = args.indexOf('--project');
const projectId =
  (projectArgIndex !== -1 ? args[projectArgIndex + 1] : undefined) ||
  process.env.FIREBASE_PROJECT_ID ||
  '';
const accessToken = process.env.FIREBASE_ACCESS_TOKEN || '';

const batchArgIndex = args.indexOf('--batch');
const pageSize = Math.min(
  MAX_PAGE_SIZE,
  Number(batchArgIndex !== -1 ? args[batchArgIndex + 1] : undefined) || 200,
);

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

if (!projectId) {
  fail(
    'No project id. Set FIREBASE_PROJECT_ID or pass --project <id>.\n' +
      '   The Firebase Web API key is NOT an access token and cannot be used here.',
  );
}

if (!accessToken) {
  fail(
    'No access token. Set FIREBASE_ACCESS_TOKEN to a token that can read and\n' +
      '   write Firestore in this project (for example `gcloud auth print-access-token`).',
  );
}

const documentsBase = `${FIRESTORE_SCOPE_HOST}/v1/projects/${projectId}/databases/${DEFAULT_DATABASE}/documents`;

/** Owner membership documents are plain Firestore documents, no special types. */
function stringField(value) {
  return { stringValue: value };
}

async function firestoreGet(pathAndQuery) {
  const response = await fetch(`${documentsBase}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GET ${pathAndQuery} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function firestoreWrite(documentPath, fields, updateMask) {
  const query = updateMask.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const response = await fetch(`${documentsBase}/${documentPath}?${query}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    throw new Error(`PATCH ${documentPath} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** Every workspace id, following pagination. */
async function listWorkspaceIds() {
  const ids = [];
  let pageToken = '';

  for (;;) {
    // A field mask is a repeated query parameter, not a nested object. Passing
    // `{ mask: { fieldPaths: ... } }` to URLSearchParams would serialise as
    // `mask=%5Bobject+Object%5D` and be ignored by the API, so the mask is built
    // as an explicit list of `mask.fieldPaths` pairs.
    const query = new URLSearchParams();
    query.set('pageSize', String(pageSize));
    query.append('mask.fieldPaths', 'name');
    query.append('mask.fieldPaths', 'fields(ownerId)');
    if (pageToken) query.set('pageToken', pageToken);

    const page = await firestoreGet(`/workspaces?${query.toString()}`);
    if (!page) break;

    for (const document of page.documents ?? []) {
      const workspaceId = document.name.split('/documents/')[1]?.split('/').pop();
      const ownerId = document.fields?.ownerId?.stringValue;
      if (workspaceId && ownerId) ids.push({ workspaceId, ownerId });
    }

    pageToken = page.nextPageToken ?? '';
    if (!pageToken) break;
  }

  return ids;
}

async function ownerMembershipExists(workspaceId, ownerId) {
  const document = await firestoreGet(
    `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(ownerId)}`,
  );
  return document;
}

/**
 * The display fields a membership document carries, read as plain values.
 *
 * A field that is absent or explicitly null counts as missing, which is what
 * makes an older row visible as "Unknown user" in the members list.
 */
function missingProfileFields(document) {
  const fields = document?.fields ?? {};
  const wanted = ['email', 'displayName', 'photoURL'];
  return wanted.filter((field) => {
    const value = fields[field];
    if (value === undefined) return true;
    if ('nullValue' in value) return true;
    if ('stringValue' in value) return value.stringValue === '';
    // A non-string value is not something this script would write; leave it be.
    return false;
  });
}

/** Copy `email`/`displayName`/`photoURL` from a user profile onto a membership. */
async function profilePatchFields(uid, missing) {
  const profile = await firestoreGet(`/users/${encodeURIComponent(uid)}`);
  const source = profile?.fields ?? {};
  const fields = {};
  for (const field of missing) {
    const value = source[field];
    if (value && typeof value.stringValue === 'string' && value.stringValue !== '') {
      fields[field] = stringField(value.stringValue);
    }
  }
  return fields;
}

function describeMembership({ workspaceId, ownerId }) {
  return `workspaces/${workspaceId}/members/${ownerId}   role="owner"`;
}

async function main() {
  console.log(`Project:  ${projectId}`);
  console.log(`Mode:     ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`);
  console.log('');

  const workspaces = await listWorkspaceIds();
  console.log(`Found ${workspaces.length} workspace(s).\n`);

  const toCreate = [];
  const skipped = [];
  // Owner memberships that exist but lost their display fields. These cannot be
  // repaired by the app: the rules refuse cross-user profile reads on purpose,
  // so the only writer that can see both documents is this script.
  const toBackfill = [];

  for (const workspace of workspaces) {
    const existing = await ownerMembershipExists(workspace.workspaceId, workspace.ownerId);
    if (existing === null) {
      toCreate.push(workspace);
      continue;
    }
    skipped.push(workspace);

    const missing = missingProfileFields(existing);
    if (missing.length > 0) {
      toBackfill.push({ ...workspace, missing });
    }
  }

  console.log(`Owner membership already present: ${skipped.length}`);
  console.log(`Owner membership to create:       ${toCreate.length}`);

  for (const entry of toBackfill) {
    const fields = await profilePatchFields(entry.ownerId, entry.missing);
    const writable = Object.keys(fields);
    if (writable.length > 0) {
      toBackfill[toBackfill.indexOf(entry)].fields = fields;
      toBackfill[toBackfill.indexOf(entry)].writable = writable;
    }
  }
  const backfillable = toBackfill.filter((entry) => (entry.writable ?? []).length > 0);
  console.log(`Owner profile to backfill:         ${backfillable.length}\n`);

  if (toCreate.length === 0 && backfillable.length === 0) {
    console.log('Nothing to do.\n');
    return;
  }

  for (const workspace of toCreate) {
    console.log(`  ${describeMembership(workspace)}`);
  }
  for (const entry of backfillable) {
    console.log(
      `  ${describeMembership(entry)}   + ${entry.writable.join(', ')}` +
        (entry.missing.length > entry.writable.length
          ? `   (unavailable: ${entry.missing.filter((f) => !entry.writable.includes(f)).join(', ')})`
          : ''),
    );
  }
  console.log('');

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to write these documents.\n');
    return;
  }

  const timestamp = new Date().toISOString();
  let created = 0;
  let patched = 0;

  for (const workspace of toCreate) {
    await firestoreWrite(
      `workspaces/${encodeURIComponent(workspace.workspaceId)}/members/${encodeURIComponent(workspace.ownerId)}`,
      {
        uid: stringField(workspace.ownerId),
        role: stringField('owner'),
        addedBy: stringField(workspace.ownerId),
        createdAt: { timestampValue: timestamp },
        updatedAt: { timestampValue: timestamp },
      },
      ['uid', 'role', 'addedBy', 'createdAt', 'updatedAt'],
    );
    created += 1;
    console.log(`  created ${describeMembership(workspace)}`);
  }

  for (const entry of backfillable) {
    await firestoreWrite(
      `workspaces/${encodeURIComponent(entry.workspaceId)}/members/${encodeURIComponent(entry.ownerId)}`,
      { ...entry.fields, updatedAt: { timestampValue: timestamp } },
      [...entry.writable, 'updatedAt'],
    );
    patched += 1;
    console.log(`  backfilled ${describeMembership(entry)}   + ${entry.writable.join(', ')}`);
  }

  console.log(`\nDone. Created ${created} owner membership document(s), backfilled ${patched}.`);
  console.log('No existing document was modified or deleted, apart from those display fields.\n');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
