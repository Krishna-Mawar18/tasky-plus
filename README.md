# Tasky - Real-time Collaborative Task Management

A modern, full-stack task management web app built with Next.js 15, TypeScript, Tailwind CSS, and Firebase. Features real-time collaboration, Kanban boards, workspaces, notifications, and a beautiful animated UI.

## ✨ Features

### 🏢 Workspace Management

- Create, edit, and delete workspaces
- Custom colors and descriptions
- Real-time workspace listing with live updates
- Owner-based access control

### 👥 Workspace Members & Roles

- Three roles per workspace: **Owner**, **Manager**, **Viewer**
- Members managed at *Workspace → Members*, by email address
- Membership stored as `workspaces/{workspaceId}/members/{uid}` and enforced by security rules
- Add, re-role and remove members are **owner-only**; a member is added as Manager or Viewer
- Change a member's role or remove them (owner only)
- Viewers get a read-only board: no task creation, editing, deletion, or drag-and-drop

### 📋 Board Management

- Create boards within workspaces
- Custom board colors and descriptions
- Default Kanban columns (To Do, In Progress, Done)
- Board listing with task counts and creation dates

### 🎯 Kanban Board (Drag-and-Drop)

- Three-column layout: To Do → In Progress → Done
- Drag cards within a column or across columns; drop position is persisted immediately
- Create tasks with title, description, priority, and due dates
- Priority levels: Low (Green), Medium (Yellow), High (Red)
- Optimistic UI updates for instant feedback, with automatic rollback if a save fails
- Task editing and deletion with confirmation modals
- Move tasks between columns with forward/back buttons
- Due date tracking with visual indicators (Overdue, Today, Tomorrow, X days)
- Disabled for Viewers, who see the same board read-only

### 👤 User Authentication

- Google Sign-In via Firebase Authentication
- Automatic user profile creation in Firestore
- Each signed-in user publishes a hashed email entry so other users can add them by address
- Protected routes with loading states
- Sign out functionality

### 🔔 Notification System

- Real-time notification panel in dashboard
- Notification types: Success, Info, Warning, Error
- Categories: Task, Workspace, System, Reminder
- Duplicate prevention with time windows
- Mark all as read / Delete all functionality
- Welcome notifications for new users
- Notifications for: task assignment, task completion, workspace creation

### 🔍 Search & Filtering

- Global search across workspaces
- Stats filtering by workspace and board
- Dynamic filter controls with dropdowns
- Filtered productivity statistics

### 📊 Dashboard Analytics

- Quick stats: Total Tasks, Completed, Pending, Productivity Score
- Visual progress bars for each metric
- Real-time stats updates
- Filter stats by workspace/board
- Recent tasks list with quick navigation

### 🎨 UI/UX Highlights

- Beautiful animated background blobs
- Notebook-style lined background
- Smooth hover animations and transitions
- Confetti celebration on sign-up
- Fully responsive (mobile, tablet, desktop)
- Reduced motion support
- Dark/light theme ready (CSS variables)

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|

| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4, CSS Animations |
| **Icons** | Lucide React, Heroicons |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Database** | Cloud Firestore (Real-time listeners) |
| **Notifications** | React Hot Toast, Custom Notification Service |
| **Fonts** | Geist Sans & Geist Mono (Google Fonts) |
| **Deployment** | Vercel |

## 📁 Project Structure

```bash
tasky/
├── public/
│   ├── tasky_logo.svg
│   ├── favicon.ico
│   └── ...
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page (marketing + auth)
│   │   ├── layout.tsx                # Root layout + providers
│   │   ├── globals.css               # Global styles + animations
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Main dashboard (workspaces, stats, notifications)
│   │   └── workspace/
│   │       ├── [workspaceId]/
│   │       │   ├── page.tsx          # Workspace view (boards list)
│   │       │   ├── settings/
│   │       │   │   └── members/
│   │       │   │       └── page.tsx  # Members list, roles, add/remove
│   │       │   └── board/
│   │       │       └── [boardId]/
│   │       │           └── page.tsx  # Kanban board view
│   │       └── ...
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Firebase auth state management
│   │   └── WorkspaceRoleContext.tsx  # Resolves the current user's role
│   ├── lib/
│   │   ├── firebase.ts               # Firebase initialization
│   │   ├── services.ts               # Firestore CRUD (workspaces, members, boards, tasks, users)
│   │   ├── permissions.ts            # Role → permission matrix
│   │   ├── memberErrors.ts           # Typed member-management errors
│   │   ├── userEmailIndex.ts         # Hash, resolve and publish user emails
│   │   ├── notificationService.ts    # Enhanced notification system
│   │   ├── taskOrder.ts              # Sparse task ordering + rebalancing
│   │   └── services_new.ts           # (Backup/alternative services)
│   ├── components/
│   │   ├── CreateModal.tsx           # Create workspace modal
│   │   ├── CreateBoardModal.tsx      # Create board modal
│   │   ├── AddMemberModal.tsx        # Add member by email + role
│   │   ├── EditWorkspaceModal.tsx    # Edit workspace modal
│   │   ├── EditBoardModal.tsx        # Edit board modal
│   │   ├── DeleteConfirmationModal.tsx
│   │   ├── KanbanBoard.tsx           # DnD context, read-only aware
│   │   ├── KanbanColumn.tsx          # Column + drop target
│   │   ├── TaskCard.tsx              # Sortable card
│   │   ├── NotificationPopup.tsx     # Toast-style notifications
│   │   ├── NotificationDrawer.tsx    # Notification side panel
│   │   ├── NotificationCard.tsx      # Individual notification card
│   │   └── SearchResults.tsx         # Search dropdown results
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   └── ...
├── scripts/
│   └── migrate-workspace-members.mjs # Optional owner-membership backfill
├── firestore.rules                   # Firestore security rules
├── firestore.indexes.json            # Composite indexes for queries
├── firebase.json                     # Firebase hosting config
├── env.example                       # Environment variables template
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project (free tier works)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tasky
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a project at [Firebase Console](https://console.firebase.google.com/)
   - Enable **Authentication** → **Google** provider
   - Enable **Firestore Database** (start in test mode)
   - Go to Project Settings → General → Your apps → Web app (</>)
   - Copy the config values

4. **Configure environment variables**

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` with your Firebase config:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

5. **Deploy Firestore indexes** (required for queries)

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore  # Select your project
   firebase deploy --only firestore:indexes
   ```

   Or use the auto-create links from console errors.

6. **Run development server**

   ```bash
   npm run dev
   ```

7. **Open** [http://localhost:3000](http://localhost:3000)

## 🔐 Workspaces, Members & Security Rules

### Roles

| Capability | Owner | Manager | Viewer |
|---|---|---|---|
| View workspace, boards, tasks, members | ✅ | ✅ | ✅ |
| Create / edit / delete boards | ✅ | ✅ | ❌ |
| Create / edit / delete tasks | ✅ | ✅ | ❌ |
| Move tasks (drag and drop) | ✅ | ✅ | ❌ |
| Add members | ✅ | ❌ | ❌ |
| Change a member's role | ✅ | ❌ | ❌ |
| Remove a member | ✅ | ❌ | ❌ |
| Edit or delete the workspace | ✅ | ❌ | ❌ |

There is exactly one owner per workspace. Ownership cannot be transferred, the
owner's membership cannot be deleted or demoted, and `owner` is not an assignable
role when adding or updating a member.

### Where a membership lives

```text
workspaces/{workspaceId}                  # the workspace itself
workspaces/{workspaceId}/members/{uid}    # role + profile  ← source of truth
workspaces/{workspaceId}.members          # derived UID list  ← discovery only
```

`workspaces.members` exists only so workspace discovery can keep using
`where('members', 'array-contains', uid)`. It is written in the same batch as
the membership document and is never read to decide a role. Roles come **only**
from the `members` subcollection, and the role matrix in
`src/lib/permissions.ts` mirrors `firestore.rules` exactly.

### Adding a member by email

A browser client cannot list Firebase Auth users, so each user publishes their
own entry in a top-level collection:

```text
userEmailIndex/{sha256(normalizedEmail)}   { uid, email, displayName, photoURL }
```

The address is trimmed and lower-cased before hashing, the document id is a
SHA-256 digest rather than the address itself, and rules restrict the collection
to `get` for any signed-in user, `list` for nobody, and writes only to the
caller's own entry with an `email` matching their own auth token. The client
re-checks the stored `email` on read, so a stale or hand-edited entry resolves to
nobody rather than the wrong account.

A consequence: **the person must have signed in to Tasky at least once** before
they can be added. There are no invitations.

That entry is written on sign-in, so the order matters when the rules change.
After deploying new rules, every existing user has to load the app once before
they become findable — a tab that was already open will have attempted the write
against the old rules and failed. The app retries on reconnect and whenever the
tab is brought back into view, and the Members page shows a banner with a
**Publish my address now** button if the signed-in user's own entry could not be
written, so a failed publish is never silent. If that banner is visible for
somebody, they cannot be added by anyone until it clears.

If an address still does not resolve once the banner is clear for both people,
the address has to match the one they signed in with character for character.

### Deploying the rules

```bash
firebase deploy --only firestore:rules --project <project id>
```

### Backfilling owner memberships

Workspaces created before memberships existed have no `members/{ownerId}`
document. Two options, neither of which touches anything else:

1. **Automatic (default).** The owner opening such a workspace repairs it, via
   `memberService.ensureOwnerMembership`. The rules permit exactly one
   self-repair: the workspace owner creating their own `owner` document. It is
   idempotent and cannot grant access to anyone else.
2. **Bulk, before deploying the rules.** `scripts/migrate-workspace-members.mjs`
   creates the same documents in one pass. It defaults to a dry run, needs
   `--apply` to write, and uses the Firestore REST API with your own OAuth
   access token — no service account file and no new npm dependency.

   ```powershell
   $env:FIREBASE_ACCESS_TOKEN = "<token from `gcloud auth print-access-token`>"
   $env:FIREBASE_PROJECT_ID   = "<project id>"
   node scripts/migrate-workspace-members.mjs           # dry run
   node scripts/migrate-workspace-members.mjs --apply   # writes
   ```

   It never migrates historic members of `workspaces.members` and never assigns
   a role to anyone except an existing `ownerId`.

### What the rules cover

- **Users** — own document only, plus a single append to a member's own
  `workspaces` array by someone who already manages that workspace
- **userEmailIndex** — point reads for signed-in users, self-writes only
- **Workspaces** — members and the owner can read; only the owner can edit or
  delete; `ownerId` is immutable; the derived UID list can only be appended by a
  manager and only removed by the owner, never removing the owner
- **Members** — readable by any member; addable by a manager or owner with role
  `manager` or `viewer`; role changes and removals are owner-only; the owner's
  own document is protected
- **Boards / Tasks** — access follows `workspaceId`, with tasks falling back to
  their board for documents written before `workspaceId` existed; managers and
  owners may write, viewers may only read
- **Notifications** — own notifications only

### Query shapes the rules expect

Because access to a board or task comes from the document itself, a `list` query
has to be narrowed by the same field the rule reads. Every query in the app
already is:

| Collection | Query |
|------------|-------|
| `workspaces` | `where('members', 'array-contains', uid)` |
| `boards` | `where('workspaceId', '==', workspaceId)` |
| `tasks` | `where('boardId', '==', boardId)` or `where('assigneeId', '==', uid)` |

A new query that filters on none of these should be treated as unproven until it
has been checked, rather than assumed to work. Verifying the rules through the
Firestore emulator is worth it before a deploy: start it with
`firebase emulators:start --only firestore`. Note that the emulator evaluates a
`list` rule against a placeholder document when the query filters on a field the
rule never reads, which can reject a query that production would allow. When
that happens, exercise the same access decision with a `get` on the document
instead of trusting the query result.

## 📝 Available Scripts

| Command | Description |
|---------|-------------|

| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc --noEmit` |

## 🏗 Data Model

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;           // Tailwind color class
  ownerId: string;         // immutable; the root of trust for access
  members: string[];       // derived UID list, kept in step with /members
  createdAt: Date;
  updatedAt: Date;
}
```

### WorkspaceMember

```typescript
interface WorkspaceMember {
  uid: string;
  role: 'owner' | 'manager' | 'viewer';
  email?: string | null;         // denormalised: avoids cross-user reads
  displayName?: string | null;
  photoURL?: string | null;
  addedBy?: string;
  addedByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Board

```typescript
interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  columns: Column[];       // Default: To Do, In Progress, Done
  createdAt: Date;
  updatedAt: Date;
}
```

### Task

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: Date | null;
  tags: string[];
  columnId: string;
  boardId: string;
  workspaceId: string;     // access is decided from this
  order: number;           // sparse position within the column
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'task' | 'workspace' | 'system' | 'reminder';
  read: boolean;
  actionUrl?: string;
  metadata?: {
    taskId?: string;
    workspaceId?: string;
    boardId?: string;
    assignerId?: string;
    assignerName?: string;
  };
  createdAt: Date;
  expiresAt?: Date;
}
```

## 🔧 Key Implementation Details

### Real-time Updates

- Uses `onSnapshot` listeners for workspaces, boards, and tasks
- Automatic UI sync across browser tabs
- Cleanup on component unmount

### Optimistic UI

- Task creation, moves, edits, deletes update UI immediately
- Background Firestore writes with rollback on error
- Eliminates perceived latency

### Notification Deduplication

- Template-based notifications with variable substitution
- Duplicate prevention per template + metadata + time window
- Cleanup utility removes old repetitive notifications

### Search

- Client-side filtering on workspace names/descriptions
- Extensible for full-text search (Algolia, Typesense)

### Performance

- `useMemo`/`useCallback` for expensive computations
- Client-side sorting (avoids composite indexes for simple orders)
- Lazy-loaded modals and components

## 🎨 Customization

### Colors

Edit `globals.css` CSS variables or Tailwind config:

```css
:root {
  --background: #f8f8f6;
  --foreground: #1a1a1a;
  /* ... */
}
```

### Animations

All animations in `globals.css` and component-level `<style jsx global>` blocks. Respects `prefers-reduced-motion`.

### Fonts

Configured in `layout.tsx` using `next/font/google` (Geist Sans + Mono).

## 🐛 Troubleshooting

### Hydration Mismatch

Caused by browser extensions modifying DOM. Suppressed via `suppressHydrationWarning` on `<body>`.

### Firestore Index Errors

```bash
The query requires an index
```

Click the link in console error, or run `firebase deploy --only firestore:indexes`.

### Firebase Config Issues

- Verify all `NEXT_PUBLIC_*` vars in `.env.local`
- Ensure Auth and Firestore are enabled in Firebase Console
- Check authorized domains in Auth settings

### Auth Not Working

- Google provider enabled in Firebase Auth?
- Domain added to authorized domains?
- `.env.local` values correct?

## 🗺 Roadmap

- [x] Drag-and-drop task reordering (dnd-kit)
- [x] Workspace members and Owner/Manager/Viewer roles
- [ ] Task comments & mentions
- [ ] Email invitations (today a member must have signed in once)

## 🤝 Contributing

This is a learning project developed in phases. Each phase is completed and tested before moving to the next.

## 📄 License

MIT License - feel free to use for learning or as a starter.

---

Built with ❤️ using Next.js, Firebase, and Tailwind CSS.
