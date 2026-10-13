# Tasky V2 — Phase 1 architecture (task collaboration, archive, storage boundary)

> **AWS S3 is intentionally NOT implemented in this phase.**
> Attachment upload/download/delete against S3 does not exist. No AWS credentials, no AWS
> SDK, no Firebase Storage, no Firestore file storage, no base64 anywhere.

This document records what already existed, what this phase adds, and exactly which files and
services have to change. It is the reference for Phase 2 (S3).

---

## 1. What already existed (inspected, not replaced)

| Area | Implementation | Notes |
| --- | --- | --- |
| Framework | Next.js 15.4.5 App Router, `src/app` | All workspace/board pages are client components |
| Board page | `src/app/workspace/[workspaceId]/board/[boardId]/page.tsx` | Owns board + task state, optimistic writes, rollbacks, all RBAC gating |
| Board UI | `src/components/KanbanBoard.tsx` → `KanbanColumn.tsx` → `TaskCard.tsx` | dnd-kit; **untouched by this phase apart from one added click handler** |
| Ordering | `src/lib/taskOrder.ts` | `order` sparse grid, `resolveTaskPlacement`, `statusForColumn`, `DEFAULT_COLUMNS` |
| Auth | Firebase Auth via Google, `src/contexts/AuthContext.tsx` | Unchanged |
| Firestore init | `src/lib/firebase.ts` | `db` is `null` when unconfigured; every service guards on it |
| Services | `src/lib/services.ts` | `workspaceService`, `memberService`, `boardService`, `taskService`, `notificationService`, `searchService`, `statsService`, `userService` |
| RBAC (UI) | `src/lib/permissions.ts` + `src/contexts/WorkspaceRoleContext.tsx` | `WorkspacePermission` union, `can()`, `isWorkspaceReadOnly()` |
| RBAC (server) | `firestore.rules` | `isWorkspaceOwner` / `hasRole` / `isManagerOrAbove` / `canViewWorkspace` |
| Membership | `workspaces/{workspaceId}/members/{uid}` | Authoritative; `workspaces.members` is a derived UID list |
| Errors | `src/lib/memberErrors.ts` (`MemberOperationError`) | Pattern reused for comment/attachment errors |
| Toasts | `react-hot-toast`, `<Toaster>` in `src/app/layout.tsx` | |
| Tests | `tests/firestore.rules.test.js` (added this phase) | Mocha + `@firebase/rules-unit-testing` against the Firestore emulator. `npm run test:rules`. No React test runner. |

Notable existing facts this phase depends on:

* `Task` already had a **single** assignee (`assigneeId`, `assigneeName`).
* `statsService.getQuickStats` queries `tasks where assigneeId == uid`, and `taskService` fires
  assignment notifications off `assigneeId`. Both must keep working, so the first assignee of a
  multi-assignee task is mirrored into those legacy fields.
* The board loads tasks once via `taskService.getTasksByBoard(boardId)` — a single
  `where('boardId', '==')` query, no `orderBy`. Archived tasks are therefore filtered **in the page
  from data already fetched**, which keeps the existing query and its index untouched.
* Drag and drop uses `PointerSensor` with `activationConstraint: { distance: 8 }`, so a click that
  does not move 8px can never start a drag. This is what makes click-to-open-modal safe.

---

## 2. Firestore schema changes

Nothing was moved between collections. Two subcollections and four task fields were added.

### `tasks/{taskId}` — additive fields only

```ts
{
  // existing …
  assigneeId?: string;      // still the *primary* assignee — unchanged semantics
  assigneeName?: string;

  assigneeIds: string[];    // new. Ordered. Empty array = unassigned.
  assigneeNames: string[];  // new. Parallel to assigneeIds.

  archived: boolean;        // new. Absent on documents written before this phase.
  archivedAt: Timestamp | null;
  archivedBy: string | null;
}
```

`assigneeId`/`assigneeName` are always written as the first entry of the parallel arrays, so
`statsService` and assignment notifications continue to behave exactly as before.

### `tasks/{taskId}/comments/{commentId}` — new subcollection

```ts
{
  uid: string;             // author, immutable
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;         // Markdown, 1..2000 chars
  createdAt: Timestamp;
  updatedAt: Timestamp;    // equals createdAt until edited
}
```

Field naming follows the existing member-document convention (`uid`, `displayName`, `photoURL`).
Comments are **never** stored as an array on the task document.

### `tasks/{taskId}/attachments/{attachmentId}` — new subcollection

```ts
{
  workspaceId: string;     // denormalised so the rules can verify the S3 key
  boardId: string;         // idem
  name: string;            // ORIGINAL filename, user-visible
  size: number;            // bytes
  contentType: string;
  s3Key: string;           // the future object key, never a URL
  uploadedBy: string;
  createdAt: Timestamp;
}
```

Firestore stores **metadata only**. No binary, no base64, no permanent public URL.

### Future S3 object key

Generated from verified IDs only, in one place (`buildAttachmentObjectKey`):

```
workspaces/{workspaceId}/boards/{boardId}/tasks/{taskId}/attachments/{attachmentId}
```

### `tasks/{taskId}/links/{linkId}` — new subcollection (added after phase 1)

```ts
{
  createdBy: string;       // uid of the member who added it, immutable
  createdByName: string;   // denormalised for rendering, same as comment authors
  title: string;           // trimmed, 1..200 chars
  url: string;             // absolute http(s) only, max 2048 chars
  hostname: string;        // denormalised from the URL, for display
  createdAt: Timestamp;
  updatedAt: Timestamp;    // equals createdAt until edited
}
```

External references a task points at. Metadata only — no object store is involved, so links remain
usable while file storage is not connected. Unlike attachments, a link is **editable**: its creator
may correct the title or address, and the creator or the workspace owner may remove it. `createdBy`
and `createdAt` are pinned so an edit cannot rewrite who added the link or when. URLs are restricted
to `http`/`https` in both `linkValidation.ts` and the rules, so a `javascript:` or `data:` target
cannot be stored. Duplicate detection compares the normalised URL and is best-effort — the query is
not transactional, which the service documents.

---

## 3. Storage abstraction

`src/lib/storageService.ts` defines the boundary:

```ts
interface AttachmentStorageProvider {
  readonly id: string;
  isAvailable(): boolean;
  uploadAttachment(input: AttachmentUploadInput): Promise<AttachmentUploadResult>;
  getDownloadUrl(input: { s3Key: string; expiresInSeconds?: number }): Promise<string>;
  deleteAttachments(keys: string[]): Promise<StorageDeletionReport>;
}
```

The only provider registered in this phase is `unconfiguredAttachmentStorageProvider`, whose three
operations throw `StorageNotConfiguredError`. It never returns a fake URL and never reports a
successful upload. `resolveAttachmentStorage()` returns it because no other provider is registered,
so Phase 2 only has to register an `S3AttachmentStorageProvider` in the same file.

The delete report is deliberately split into `deleted` / `pending` so a deletion can never *look*
complete when the object store is unreachable — see §6.

---

## 4. Layering

```
AttachmentSection (UI)
      ↓
attachmentService.attachFile()      validation + duplicate check + metadata write
      ↓
resolveAttachmentStorage()          provider boundary  ← S3 plugs in here in Phase 2
      ↓
(unconfigured provider — throws)

commentService        Firestore only, no storage
taskService           task CRUD, archive/restore, cascade delete
taskCleanupService    90-day expiry foundation (NOT scheduled)
```

---

## 5. Authorization matrix

Enforced in **both** `src/lib/permissions.ts` (UI) and `firestore.rules` (server). The rules are
authoritative; the UI only decides what to draw.

| Capability | Owner | Manager | Viewer |
| --- | --- | --- | --- |
| Read task / comments / attachments | yes | yes | yes |
| Create comment | yes | yes | yes |
| Edit own comment | yes | yes | yes |
| Delete any comment | yes | no | no |
| Delete own comment | yes | yes | yes |
| Read / download attachment | yes | yes | yes |
| Upload attachment | yes | yes | no |
| Delete any attachment | yes | no | no |
| Delete own attachment | yes | yes | no |
| Read links | yes | yes | yes |
| Add link | yes | yes | no |
| Edit own link | yes | yes | no |
| Delete any link | yes | no | no |
| Delete own link | yes | yes | no |
| Archive / restore task | yes | yes | no |
| Permanently delete task | yes | yes | no |

Viewer comment access is intentional. A viewer still cannot edit, move, archive or delete a task.

Rules hardened in this phase (all additive restrictions, nothing weakened):

1. **Comment author binding** — `authorId`/`uid` must equal `request.auth.uid` on create and cannot
   be changed on update.
2. **Comment edit scope** — update may touch only `content` and `updatedAt`.
3. **Attachment uploader binding** — `uploadedBy` must equal `request.auth.uid`.
4. **Attachment key verification** — `s3Key` must equal the key rebuilt from the attachment document's
   own ids, and those ids must match the parent task's real `workspaceId`/`boardId`. A client cannot
   point a key at another workspace.
5. **Attachment assignee-style membership proof** — none needed; uploads are manager+ only.
6. **Assignee membership** — every id in `assigneeIds` must appear in the workspace's `members`
   array. This is what stops a task being assigned to somebody outside the workspace. A task may
   carry at most **5** assignees (`MAX_ASSIGNEES` in `AssigneePicker.tsx`, `<= 5` in the rules):
   each membership check is a separate document read and Firestore permits 10 per single-document
   request, two of which the task-update rule already spends on the workspace and the caller.
7. **Archive audit consistency** — a task may only transition *into* `archived: true` with
   `archivedBy == request.auth.uid` and a non-null `archivedAt`. Without this, a client could archive
   a task with no timestamp and the 90-day cleanup could never find it.
8. **Attachments are immutable** — there is no `update` rule for the subcollection.
9. **Link scheme and size limits** — a link's `url` must match `^https?://` and be at most 2048
   characters; the title must be 1..200 characters. `createdBy`/`createdAt` are pinned on edit and an
   update may touch only `title`, `url`, `hostname` and `updatedAt`.

---

## 6. Deletion architecture

```
permanent delete
  ↓
RBAC (manager+) — Firestore rules on tasks/{id}
  ↓
confirmation dialog
  ↓
read tasks/{id}/attachments  → collect s3Keys
  ↓
delete comments
  ↓
delete attachment metadata
  ↓
delete links
  ↓
storageProvider.deleteAttachments(s3Keys)
      → { deleted: [], pending: [ … ] }   ← honest while S3 is absent
  ↓
delete task
```

`deleteTaskCascade` returns a `TaskDeletionReport`, whose `storage` field is a
`StorageDeletionReport` with `deleted` / `pending` arrays. When `report.storage.pending` is non-empty
the page raises a warning toast naming the count, and the confirmation dialog states that uploaded
files are removed *once S3 is connected*. Nothing is silently dropped.

---

## 7. Archive / retention

* Archived tasks stay in the `tasks` collection with `archived: true`. Nothing moves.
* The board filters `tasks` in memory, so the existing `where('boardId', '==')` query and index are
  untouched.
* `restoreTask` returns the task to `task.columnId`. If that column no longer exists it falls back,
  in order, to the first column in board order — never a new task, never a new id.
* `ARCHIVE_RETENTION_DAYS = 90` in `src/lib/taskArchive.ts`.
* `taskCleanupService.findExpiredArchivedTasks()` runs
  `where('archived', '==', true) + where('archivedAt', '<=', cutoff)` and
  `purgeExpiredArchivedTasks()` performs the cascade. **Nothing calls it.** There is no timer, no
  client-side scheduler, no new cloud scheduler.

---

## 8. Firestore indexes

`firestore.indexes.json` gains three entries:

```json
// the expiry sweep
{ "collectionGroup": "tasks", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "archived",    "order": "ASCENDING" },
    { "fieldPath": "archivedAt",  "order": "ASCENDING" }
  ] }

// "tasks assigned to me", now that a task can have several assignees
{ "collectionGroup": "tasks", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "assigneeIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "createdAt",   "order": "DESCENDING" }
  ] }
```

(The third, pre-existing entry is the `assigneeId` + `status` query used by quick stats.)

Deliberately **not** added:

* **Comments** — `orderBy('createdAt','desc')` on a single-collection subcollection query with a
  `limit` uses Firestore's automatic single-field index.
* **Archived tasks on the board** — no new query is issued; the page filters the existing
  `where('boardId','==')` result in memory.

---

## 9. Phase 2 (S3) — the remaining work

1. Create the bucket + IAM role + CORS. Nothing in the repo needs it yet.
2. Add server-side credentials. The browser must never hold them, so upload goes through a
   pre-signed-POST endpoint (`/api/uploads/presign`) rather than the SDK in the client. That also
   keeps `uploadAttachment`'s caller → provider contract intact.
3. Implement `S3AttachmentStorageProvider` in `src/lib/storageService.ts` and register it in
   `resolveAttachmentStorage()`. Implement all three interface methods; no caller changes.
4. Wire `deleteAttachments()` into the cascade and the 90-day cleanup — the `pending` list then
   becomes a real deletion.
5. Enforce `s3Key`/size/content-type server-side on the presign endpoint as well as in the rules.
   The rules cannot inspect a file, only metadata.
6. Add `getDownloadUrl()` presigned-GET support and turn on inline image previews for
   jpg/jpeg/png. pdf/xls/xlsx/md stay download-only.
7. Schedule `taskCleanupService.purgeExpiredArchivedTasks()` from Cloud Scheduler → Cloud Function
   with the Admin SDK, because it must delete across workspaces and bypass rules.
8. Add `NEXT_PUBLIC_*`-free server env vars for the bucket/region/role and document them in
   `env.example`.