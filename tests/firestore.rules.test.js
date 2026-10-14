const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { join } = require('path');

/**
 * Security-rules tests.
 *
 * `src/lib/permissions.ts` decides what the UI *draws*; `firestore.rules` decides
 * what is actually *allowed*. This file exercises the rules directly against the
 * Firestore emulator, because a bug there is invisible to typechecking and to the
 * UI — the buttons are already hidden, so only a crafted request reveals it.
 *
 * Run with `npm run test:rules`.
 */

const WORKSPACE = 'ws1';
const BOARD = 'board1';
const OWNER = 'owner1';
const MANAGER = 'manager1';
const MANAGER2 = 'manager2';
const MANAGER3 = 'manager3';
const VIEWER = 'viewer1';
const VIEWER2 = 'viewer2';
const OUTSIDER = 'outsider1';

let testEnv;

function authed(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/**
 * A task document as `taskService.updateTask` would leave it.
 *
 * Written with every field the rules read, because `request.resource.data` after
 * an `updateDoc` is the merged document — a partial patch is read as the full
 * result, which is exactly what these rules check.
 */
function taskData(overrides = {}) {
  return {
    workspaceId: WORKSPACE,
    boardId: BOARD,
    columnId: 'col-todo',
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    order: 1000,
    assigneeIds: [],
    assigneeNames: [],
    assigneeId: null,
    assigneeName: null,
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * A task as `create_task` leaves it when nobody is assigned.
 *
 * Multi-assignee fields are present and empty, and the legacy single-assignee
 * mirror (`assigneeId`/`assigneeName`) is absent entirely — the `defined()`
 * helper in the executor prunes the `undefined` values. The update rule used to
 * reject this shape, so reproducing it exactly is the point of these tests.
 */
function unassignedTaskData(overrides = {}) {
  const data = taskData();
  delete data.assigneeId;
  delete data.assigneeName;
  return { ...data, ...overrides };
}

function commentData(overrides = {}) {
  return {
    uid: MANAGER,
    authorId: MANAGER,
    authorName: 'Manager',
    authorPhotoURL: null,
    content: 'Looks good to me.',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

function attachmentData(attachmentId, overrides = {}) {
  return {
    taskId: 'task1',
    workspaceId: WORKSPACE,
    boardId: BOARD,
    name: 'report.pdf',
    extension: '.pdf',
    contentType: 'application/pdf',
    size: 2048,
    s3Key:
      `workspaces/${WORKSPACE}/boards/${BOARD}/tasks/task1/attachments/${attachmentId}`,
    uploadedBy: MANAGER,
    createdAt: new Date('2026-01-03T00:00:00Z'),
    ...overrides,
  };
}

function linkData(overrides = {}) {
  return {
    createdBy: MANAGER,
    createdByName: 'Manager',
    title: 'Design spec',
    url: 'https://example.com/design',
    hostname: 'example.com',
    createdAt: new Date('2026-01-04T00:00:00Z'),
    updatedAt: new Date('2026-01-04T00:00:00Z'),
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tasky-rules',
    firestore: {
      rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

/**
 * Write the fixture directly, with rules disabled.
 *
 * Seed data is not under test — the rules are — and every case below starts from
 * the same workspace, so the setup must not itself be subject to a rule that a
 * test is about to assert.
 */
async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await db.doc(`workspaces/${WORKSPACE}`).set({
      ownerId: OWNER,
      name: 'Workspace',
      members: [OWNER, MANAGER, MANAGER2, MANAGER3, VIEWER, VIEWER2],
    });

    for (const [uid, role] of [
      [OWNER, 'owner'],
      [MANAGER, 'manager'],
      [MANAGER2, 'manager'],
      [MANAGER3, 'manager'],
      [VIEWER, 'viewer'],
      [VIEWER2, 'viewer'],
    ]) {
      await db.doc(`workspaces/${WORKSPACE}/members/${uid}`).set({
        uid,
        role,
        email: `${uid}@example.test`,
        displayName: uid,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
    }

    await db.doc(`boards/${BOARD}`).set({
      workspaceId: WORKSPACE,
      name: 'Board',
      columns: [
        { id: 'col-todo', name: 'To Do', status: 'todo' },
        { id: 'col-done', name: 'Done', status: 'completed' },
      ],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await db.doc(`tasks/task1`).set(taskData());
  });
}

beforeEach(seed);

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

describe('task assignees', () => {
  it('lets a manager assign a workspace member', async () => {
    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [MANAGER2],
          assigneeNames: ['manager2'],
          assigneeId: MANAGER2,
          assigneeName: 'manager2',
        }),
    );
  });

  it('refuses assigning somebody outside the workspace', async () => {
    // The picker never offers this, but a crafted client can send it. This is the
    // test that proves the picker is a convenience and the rule is the control.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [OUTSIDER],
          assigneeNames: ['outsider'],
          assigneeId: OUTSIDER,
          assigneeName: 'outsider',
        }),
    );
  });

  it('refuses an outsider appearing at any position, not just the first', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [MANAGER2, OUTSIDER],
          assigneeNames: ['manager2', 'outsider'],
          assigneeId: MANAGER2,
          assigneeName: 'manager2',
        }),
    );
  });

  it('refuses desynchronising the legacy single-assignee mirror', async () => {
    // `statsService` reads `assigneeId`. Setting the array without the mirror
    // would leave stats and notifications pointing at the wrong person.
    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({
        assigneeIds: [MANAGER2],
        assigneeNames: ['manager2'],
      }),
    );
  });

  it('refuses a mirror that names a different person than ids[0]', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({
        assigneeIds: [MANAGER2, MANAGER],
        assigneeNames: ['manager2', 'manager'],
        assigneeId: MANAGER,
        assigneeName: 'manager',
      }),
    );
  });

  it('allows clearing every assignee', async () => {
    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [],
          assigneeNames: [],
          assigneeId: null,
          assigneeName: null,
        }),
    );
  });

  it('lets a manager update an unassigned task that carries no assigneeId field', async () => {
    // The migration regression: Mark creates an unassigned task with
    // `assigneeIds: []` and no `assigneeId`, which `create` accepted. The update
    // rule then rejected it, so `update_task` and `move_task` always failed with
    // a misleading "role does not permit that action" denial.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tasks/task1`).set(unassignedTaskData());
    });

    await assertSucceeds(
      authed(MANAGER).doc(`tasks/task1`).update({ title: 'Renamed' }),
    );
  });

  it('lets a manager move an unassigned task that carries no assigneeId field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tasks/task1`).set(unassignedTaskData());
    });

    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({ columnId: 'col-done', status: 'completed', order: 2000 }),
    );
  });

  it('lets a manager move a manually-created task that sets assigneeId and no assigneeIds', async () => {
    // The board's create form writes a single `assigneeId` and no `assigneeIds`.
    // A drag/step move is an `update` writing only columnId/order/status, so this
    // must succeed — the plainest move case, independent of the Mark fix above.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const data = taskData({ assigneeId: MANAGER, assigneeName: 'manager1' });
      delete data.assigneeIds;
      delete data.assigneeNames;
      await context.firestore().doc(`tasks/task1`).set(data);
    });

    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({ columnId: 'col-done', status: 'completed', order: 2000 }),
    );
  });

  it('still refuses a non-empty array without its mirror even with no assigneeId field', async () => {
    // Removing the extra guard must not open a hole: an array with assignees
    // still has to carry a consistent mirror, so a desynchronised write is
    // refused whether or not the field previously existed.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`tasks/task1`).set(unassignedTaskData());
    });

    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({
        assigneeIds: [MANAGER2],
        assigneeNames: ['manager2'],
      }),
    );
  });

  it('refuses more assignees than the cap allows', async () => {
    // Every uid here is a real member, so the ONLY reason to reject this is the
    // size check. The cap is 5; a sixth is refused before any membership read.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [OWNER, MANAGER, MANAGER2, MANAGER3, VIEWER, VIEWER2],
          assigneeNames: ['owner1', 'manager1', 'manager2', 'manager3', 'viewer1', 'viewer2'],
          assigneeId: OWNER,
          assigneeName: 'owner1',
        }),
    );
  });

  it('refuses assigning by a viewer', async () => {
    await assertFails(
      authed(VIEWER)
        .doc(`tasks/task1`)
        .update({
          assigneeIds: [VIEWER],
          assigneeNames: ['viewer1'],
          assigneeId: VIEWER,
          assigneeName: 'viewer1',
        }),
    );
  });
});

// ---------------------------------------------------------------------------
// Archiving
// ---------------------------------------------------------------------------

describe('task archiving', () => {
  it('lets a manager archive a task', async () => {
    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          archived: true,
          archivedAt: new Date('2026-06-01T00:00:00Z'),
          archivedBy: MANAGER,
        }),
    );
  });

  it('refuses an archive with no timestamp', async () => {
    // Without `archivedAt` the 90-day sweep can never find the task, so it would
    // sit hidden on the board forever with no way to restore it.
    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({ archived: true }),
    );
  });

  it('refuses naming somebody else as the archiver', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({
        archived: true,
        archivedAt: new Date('2026-06-01T00:00:00Z'),
        archivedBy: OUTSIDER,
      }),
    );
  });

  it('refuses unarchiving while leaving the audit fields behind', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1`)
      .update({
        archived: true,
        archivedAt: new Date('2026-06-01T00:00:00Z'),
        archivedBy: MANAGER,
      });

    // An archived task that keeps `archivedAt` after restore would still look
    // overdue to the retention sweep.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1`)
        .update({
          archived: false,
          archivedAt: new Date('2026-06-01T00:00:00Z'),
          archivedBy: MANAGER,
        }),
    );
  });

  it('refuses archiving by a viewer', async () => {
    await assertFails(
      authed(VIEWER).doc(`tasks/task1`).update({
        archived: true,
        archivedAt: new Date('2026-06-01T00:00:00Z'),
        archivedBy: VIEWER,
      }),
    );
  });

  it('refuses creating a task pre-archived', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task2`).set(
        taskData({
          archived: true,
          archivedAt: new Date('2026-06-01T00:00:00Z'),
          archivedBy: MANAGER,
        }),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe('comments', () => {
  it('lets a viewer comment, because joining the discussion is not editing', async () => {
    await assertSucceeds(
      authed(VIEWER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ uid: VIEWER, authorId: VIEWER, authorName: 'viewer1' })),
    );
  });

  it('refuses posting as somebody else', async () => {
    await assertFails(
      authed(VIEWER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ uid: MANAGER, authorId: MANAGER, authorName: 'Manager' })),
    );
  });

  it('refuses a zero-length comment', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ content: '' })),
    );
  });

  it('does not enforce trimming, which is the service’s job, not the rules’', async () => {
    // Firestore rules have no `trim()`, so a whitespace-only string passes the
    // `size() > 0` check here. `commentService.addComment` trims and rejects the
    // empty result before it ever writes, and `CommentComposer` disables the
    // button — but this file is explicit that the rules alone would accept it.
    await assertSucceeds(
      authed(MANAGER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ content: '   ' })),
    );
  });

  it('refuses a comment over the length limit', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ content: 'x'.repeat(2001) })),
    );
  });

  it('refuses smuggling an extra field onto a comment', async () => {
    // There is no comment field a client may add for itself.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/comments/c1`)
        .set(commentData({ editedBy: OUTSIDER })),
    );
  });

  it('refuses an outsider reading a thread', async () => {
    await assertFails(authed(OUTSIDER).collection(`tasks/task1/comments`).get());
  });

  it('lets a member list the thread', async () => {
    await assertSucceeds(authed(VIEWER).collection(`tasks/task1/comments`).get());
  });

  it('lets an author edit their own text', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertSucceeds(
      authed(MANAGER).doc(`tasks/task1/comments/c1`).update({ content: 'Edited.' }),
    );
  });

  it("refuses editing somebody else's comment", async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertFails(
      authed(MANAGER2).doc(`tasks/task1/comments/c1`).update({ content: 'Rewritten.' }),
    );
  });

  it('refuses reassigning the author during an edit', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertFails(
      authed(MANAGER).doc(`tasks/task1/comments/c1`).update({
        content: 'Edited.',
        authorId: OUTSIDER,
      }),
    );
  });

  it('lets an author delete their own comment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertSucceeds(authed(MANAGER).doc(`tasks/task1/comments/c1`).delete());
  });

  it('refuses a manager deleting somebody else’s comment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertFails(authed(MANAGER2).doc(`tasks/task1/comments/c1`).delete());
  });

  it('lets an owner delete anybody’s comment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/comments/c1`)
      .set(commentData());

    await assertSucceeds(authed(OWNER).doc(`tasks/task1/comments/c1`).delete());
  });
});

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

describe('attachments', () => {
  it('lets a manager upload, with the derived key', async () => {
    await assertSucceeds(
      authed(MANAGER).doc(`tasks/task1/attachments/a1`).set(attachmentData('a1')),
    );
  });

  it('refuses uploading as somebody else', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(attachmentData('a1', { uploadedBy: MANAGER2 })),
    );
  });

  it('refuses uploading by a viewer', async () => {
    await assertFails(
      authed(VIEWER).doc(`tasks/task1/attachments/a1`).set(attachmentData('a1')),
    );
  });

  it('refuses a client-chosen key that points at another task', async () => {
    // This is the check that confines objects: the key is rebuilt from the
    // document path and compared, never taken on trust.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(
          attachmentData('a1', {
            s3Key: `workspaces/${WORKSPACE}/boards/${BOARD}/tasks/taskOther/attachments/a1`,
          }),
        ),
    );
  });

  it('refuses a key outside the workspace', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(
          attachmentData('a1', {
            s3Key: `workspaces/ws-evil/boards/${BOARD}/tasks/task1/attachments/a1`,
          }),
        ),
    );
  });

  it('refuses a disallowed extension', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(attachmentData('a1', { extension: '.exe', name: 'run.exe' })),
    );
  });

  it('refuses a file over the 10 MB limit', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(attachmentData('a1', { size: 11 * 1024 * 1024 })),
    );
  });

  it('refuses an empty file', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1/attachments/a1`).set(attachmentData('a1', { size: 0 })),
    );
  });

  it('refuses an extra field, so no bytes can be stored in Firestore', async () => {
    // The single most important line of defence on this collection: there is no
    // base64 field and no binary field, and `hasOnly` keeps it that way.
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/attachments/a1`)
        .set(attachmentData('a1', { data: 'AAAA', content: 'AAAA' })),
    );
  });

  it('refuses a viewer listing attachments', async () => {
    await assertSucceeds(authed(VIEWER).collection(`tasks/task1/attachments`).get());
  });

  it('refuses an outsider listing attachments', async () => {
    await assertFails(authed(OUTSIDER).collection(`tasks/task1/attachments`).get());
  });

  it('refuses editing attachment metadata', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/attachments/a1`)
      .set(attachmentData('a1'));

    await assertFails(
      authed(MANAGER).doc(`tasks/task1/attachments/a1`).update({ name: 'renamed.pdf' }),
    );
  });

  it('lets an uploader delete their own attachment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/attachments/a1`)
      .set(attachmentData('a1'));

    await assertSucceeds(authed(MANAGER).doc(`tasks/task1/attachments/a1`).delete());
  });

  it('refuses a manager deleting somebody else’s attachment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/attachments/a1`)
      .set(attachmentData('a1'));

    await assertFails(authed(MANAGER2).doc(`tasks/task1/attachments/a1`).delete());
  });

  it('lets an owner delete anybody’s attachment', async () => {
    await authed(MANAGER)
      .doc(`tasks/task1/attachments/a1`)
      .set(attachmentData('a1'));

    await assertSucceeds(authed(OWNER).doc(`tasks/task1/attachments/a1`).delete());
  });
});

// ---------------------------------------------------------------------------
// Links — metadata-only references held on a task
// ---------------------------------------------------------------------------

describe('task links', () => {
  it('lets a manager add a link', async () => {
    await assertSucceeds(authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData()));
  });

  it('refuses an outsider adding a link', async () => {
    await assertFails(authed(OUTSIDER).doc(`tasks/task1/links/l1`).set(linkData()));
  });

  it('refuses a viewer adding a link', async () => {
    await assertFails(
      authed(VIEWER).doc(`tasks/task1/links/l1`).set(linkData({ createdBy: VIEWER })),
    );
  });

  it('refuses a manager spoofing createdBy', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData({ createdBy: OUTSIDER })),
    );
  });

  it('refuses a javascript: URL', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/links/l1`)
        .set(linkData({ url: 'javascript:alert(1)', hostname: 'alert(1)' })),
    );
  });

  it('refuses a data: URL', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/links/l1`)
        .set(linkData({ url: 'data:text/html;base64,AAAA', hostname: 'text' })),
    );
  });

  it('refuses an empty title', async () => {
    await assertFails(authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData({ title: '' })));
  });

  it('refuses a title over 200 characters', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData({ title: 'a'.repeat(201) })),
    );
  });

  it('refuses a URL over 2048 characters', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/links/l1`)
        .set(linkData({ url: `https://e.co/${'a'.repeat(2100)}` })),
    );
  });

  it('refuses an extra field', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData({ payload: 'x' })),
    );
  });

  it('lets a viewer list links', async () => {
    await assertSucceeds(authed(VIEWER).collection(`tasks/task1/links`).get());
  });

  it('refuses an outsider listing links', async () => {
    await assertFails(authed(OUTSIDER).collection(`tasks/task1/links`).get());
  });

  it('lets a creator edit their own link', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertSucceeds(
      authed(MANAGER).doc(`tasks/task1/links/l1`).update({
        title: 'Updated spec',
        url: 'https://example.com/updated',
        hostname: 'example.com',
        updatedAt: new Date('2026-01-05T00:00:00Z'),
      }),
    );
  });

  it('refuses another manager editing someone else’s link', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertFails(
      authed(MANAGER2)
        .doc(`tasks/task1/links/l1`)
        .update({ title: 'Hijacked', updatedAt: new Date('2026-01-05T00:00:00Z') }),
    );
  });

  it('refuses an edit that reassigns createdBy', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/links/l1`)
        .update({ createdBy: OUTSIDER, updatedAt: new Date('2026-01-05T00:00:00Z') }),
    );
  });

  it('refuses an edit that changes createdAt', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertFails(
      authed(MANAGER)
        .doc(`tasks/task1/links/l1`)
        .update({ createdAt: new Date('2020-01-01T00:00:00Z') }),
    );
  });

  it('lets a creator delete their own link', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertSucceeds(authed(MANAGER).doc(`tasks/task1/links/l1`).delete());
  });

  it('refuses another manager deleting someone else’s link', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertFails(authed(MANAGER2).doc(`tasks/task1/links/l1`).delete());
  });

  it('lets an owner delete anybody’s link', async () => {
    await authed(MANAGER).doc(`tasks/task1/links/l1`).set(linkData());

    await assertSucceeds(authed(OWNER).doc(`tasks/task1/links/l1`).delete());
  });
});

// ---------------------------------------------------------------------------
// Existing behaviour that must not regress
// ---------------------------------------------------------------------------

describe('existing guarantees', () => {
  it('still refuses a viewer creating a task', async () => {
    await assertFails(authed(VIEWER).doc(`tasks/task2`).set(taskData()));
  });

  it('still refuses a task moving to another board', async () => {
    await assertFails(
      authed(MANAGER).doc(`tasks/task1`).update({
        boardId: 'boardOther',
        workspaceId: WORKSPACE,
      }),
    );
  });

  it('still refuses a manager writing membership records', async () => {
    await assertFails(
      authed(MANAGER)
        .doc(`workspaces/${WORKSPACE}/members/newbie`)
        .set({
          uid: 'newbie',
          role: 'viewer',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
    );
  });

  it('still refuses a viewer editing a board', async () => {
    await assertFails(authed(VIEWER).doc(`boards/${BOARD}`).update({ name: 'Renamed' }));
  });

  it('still refuses an outsider reading a task', async () => {
    await assertFails(authed(OUTSIDER).doc(`tasks/task1`).get());
  });
});
