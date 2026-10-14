# Tasky - Real-time Collaborative Task Management

A modern, full-stack task management web app built with Next.js 15, TypeScript, Tailwind CSS, and Firebase. Features real-time collaboration, Kanban boards, workspaces, role-based access, task comments, attachments, external links, archiving, notifications, a beautiful animated UI — and **Mark**, a built-in AI manager agent that can read and, with your approval, change your Tasky data.

> **Note on file storage:** upload/download/delete of attachment *files* against object
> storage (AWS S3) is **not implemented yet**. Attachment metadata, comments and external
> links work today; the object-store boundary (`src/lib/storageService.ts`) is defined and
> ready for S3 to plug in. See `docs/v2-phase1-architecture.md` and the Roadmap.

> **Note on Mark:** Mark ships today and is fully wired end to end. It needs at least one
> model-provider key (NVIDIA or Groq) in the server environment; see
> [Mark — the Tasky Manager Agent](#-mark-the-tasky-manager-agent).

## ✨ Features

### 🤖 Mark — the AI Manager Agent

- A conversational assistant that reads and (with explicit approval) changes your Tasky data
- Understands natural requests: *"move the API task to Done"*, *"what's overdue this week?"*, *"archive the stale sprint tasks"*
- 36 typed tools spanning workspaces, boards, tasks, comments, links, attachments (count only) and analytics
- **Destructive actions always require an approval card** showing exactly what will change and what it means
- Tasky-only scope guard, role-aware authorization, and untrusted-data handling
- Provider-agnostic: NVIDIA (default) or Groq, with automatic failover and transient-failure retries
- Dedicated `/mark` page with a workspace/board context switcher; opened via the floating "Ask Mark" button
- See [Mark — the Tasky Manager Agent](#-mark-the-tasky-manager-agent) for the full design

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
- Move tasks between columns with forward/back buttons
- Due date tracking with visual indicators (Overdue, Today, Tomorrow, X days)
- Disabled for Viewers, who see the same board read-only

### 🗂 Task Detail Modal

- Opens over the board without navigating, so scroll position and drag state are preserved
- Read, edit and delete a task without leaving the board (viewers can open and read)
- **Multiple assignees** (up to 5), chosen from workspace members only
- Markdown descriptions, priority, due date and tags
- Comment thread, attachments and external links all live here
- Archive / restore and permanent delete (manager and above)

### 💬 Comments

- Per-task discussion thread at `tasks/{taskId}/comments/{commentId}`
- Markdown content, rendered through a sanitising renderer
- Everyone in the workspace — including Viewers — can read and post comments
- Authors edit their own comments; the workspace owner can delete any comment
- Live updates via a Firestore snapshot listener

### 📎 Attachments (metadata only)

- Per-task attachments at `tasks/{taskId}/attachments/{attachmentId}`
- Accepted types: jpg, jpeg, png, pdf, xls, xlsx, md; hard ceiling of 10 MB
- Uploads and downloads are **disabled until an object store is connected**
- Firestore stores metadata only — no binary, no base64, no permanent public URL
- Duplicate-filename detection, and image inline preview once storage lands

### 🔗 External Links

- Per-task links at `tasks/{taskId}/links/{linkId}`
- A reference list for a task, independent of file storage, so it works today
- URLs restricted to `http`/`https` (a `javascript:`/`data:` target cannot be stored)
- The creator can edit the title or address; the creator or workspace owner can remove it

### 🗄 Task Archiving & Retention

- Archive a task to hide it from the board without deleting it
- Archived tasks are filtered out of the board **from data already fetched** (no extra query)
- A collapsible Archived panel lists them, with restore and permanent delete
- 90-day retention clock is tracked on `archivedAt`
- A cleanup service (`taskCleanupService`) exists for the expiry sweep but is **not scheduled** yet

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

## 🤖 Mark, the Tasky Manager Agent

Mark is a conversational agent embedded in Tasky that helps a signed-in user manage
their own workspaces, boards, tasks, comments and links in natural language. It can
read data, answer questions about it, and — only with an explicit approval from the
user — change it.

> Mark is deliberately **not** a general assistant. It answers only about Tasky, never
> writes code, never does research, and never touches data outside the signed-in user's
> own workspaces.

### Using Mark

- A floating **"Ask Mark"** button is mounted in the root layout on every signed-in
  screen. It opens the dedicated `/mark` page, carrying the current workspace/board
  (and, from a task, the task) as context.
- The `/mark` page shows a timeline of user messages, assistant replies, tool activity
  chips and errors, plus an approval dialog when a destructive action needs a decision.
- The header has a workspace/board **context switcher**. Context is a *hint* — it saves
  Mark from asking which workspace you mean, and is re-validated on every execution.

### What Mark can do (36 tools)

The tool catalog is a single server-owned allowlist (`src/mark/tools/definitions.ts`).
A tool that is not in it is rejected before it can do anything.

| Group | Tools |
|-------|-------|
| Identity | `get_current_user` (verified identity + own role, never model-supplied) |
| Workspaces | `list_workspaces`, `get_workspace`, `create_workspace`, `update_workspace`, `delete_workspace` |
| Members (read-only) | `list_workspace_members` |
| Boards | `list_boards`, `get_board`, `create_board`, `update_board`, `delete_board` |
| Tasks (read) | `list_tasks`, `get_task`, `search_tasks` |
| Tasks (write) | `create_task`, `update_task`, `move_task`, `assign_task`, `archive_task`, `restore_task`, `delete_task` |
| Comments | `list_comments`, `create_comment`, `update_comment`, `delete_comment` |
| Links | `list_links`, `add_link`, `delete_link` |
| Attachments | `get_attachment_count` (count only — Mark cannot read files) |
| Analytics | `get_workspace_analytics`, `get_board_analytics`, `get_member_workload`, `get_overdue_tasks` |
| Bulk | `bulk_archive_tasks`, `bulk_delete_tasks` |

Tools declared **destructive** (`delete_workspace`, `delete_board`, `delete_task`,
`delete_comment`, `delete_link`, `bulk_delete_tasks`) always require approval. A bulk or
sized operation that crosses the configured thresholds also requires approval, and one
that crosses the high-risk threshold is escalated to destructive.

### Safety model

The guiding rule is that the **model is never the authority**. It proposes; the
application decides and executes.

1. **No model → Firestore path.** The browser orchestrator (`src/mark/orchestrator.ts`)
   drives the turn loop. Every tool call the model proposes is authorized and executed
   *locally*, under the user's own Firebase session, never by the model.
2. **Scope guard first.** Before any provider call, a deterministic
   `classifyScope` check refuses clearly unrelated requests and instruction-extraction
   attempts (e.g. "ignore your rules", "reveal your system prompt") without spending a
   provider token.
3. **Server-owned prompt and tools.** The system prompt and tool schemas live only on
   the server (`/api/mark`); the client sends conversation turns only. A client-supplied
   `system` turn is rejected outright, so the prompt cannot be replaced from the browser.
4. **Role-aware authorization.** `authorizeTool` maps each tool onto the existing
   `src/lib/permissions.ts` matrix, resolving the caller's *real* role from Firestore —
   never from an id the model supplied. `firestore.rules` remains the final authority on
   the eventual read/write.
5. **Resource resolution.** Every id the model supplies is untrusted
   (`src/mark/resolve.ts`): the target is confirmed to exist, be reachable by the caller,
   and belong to the expected workspace → board → task chain. Missing and unauthorized
   return the *same* generic reason, so the guard cannot be used to probe for resources.
6. **Deterministic risk.** Risk and approval-required come from the catalog and the
   affected count (`src/mark/policy/risk.ts`), never from the model. Runtime factors can
   only *raise* a level.
7. **Bound, single-use approvals.** An approval is bound to the user, the canonical
   tool + arguments, the affected resources, and an expiry. Changing any material
   argument produces a different canonical key, so a stale approval can never authorize a
   new action. Approvals are single-use and fail closed (wrong user, expired, consumed,
   cancelled, or changed all refuse). The model cannot reach the approval store.
8. **Concrete previews.** A destructive action is shown with a human-readable list of the
   exact resources ("Task: '…'", "3 comments will be deleted") and its consequences
   before anything runs (`src/mark/policy/preview.ts`).
9. **Redaction & minimal audit.** Replies are stripped of internal ids and context hints
   before display. A short, redacted in-memory audit trail records the tool, risk,
   affected count and outcome — never prompts, model output, keys or whole documents.
10. **No privileged credentials.** `/api/mark` refuses anonymous traffic by verifying a
    Firebase ID token's RS256 signature against Google's public certs
    (`src/mark/providers/verifyToken.ts`) — no `firebase-admin`, no service account.
11. **Repeat suppression.** Within a single user turn, an identical tool+arguments call is
    answered from a cache instead of executed twice, so an approved mutation can never run
    twice even if the model re-issues it.

### Providers & reliability

Mark is provider-agnostic and hides the provider behind one stateless server route, so
switching or falling back never changes scope, policy or data access — only which
endpoint answers.

- **Providers.** NVIDIA NIM (default, `nvidia/nemotron-3-ultra-550b-a55b`) with Groq
  (`qwen/qwen3.8-27b`) as fallback. Both speak the OpenAI chat-completions tool-calling
  API via a shared transport (`src/mark/providers/openaiCompatible.ts`).
- **Failover.** `generateWithFallback` tries the configured providers in order. Only
  *recoverable* failures move on to the next provider — timeouts, rate limits and
  transient 5xx. A bad request or malformed response stops immediately, because retrying
  would repeat the mistake and falling back would mask a genuine defect.
- **Retries.** Hosted inference endpoints intermittently return 5xx/429 under load.
  Before giving up on a provider, Mark retries it with exponential backoff and jitter
  (`MARK_PROVIDER_MAX_ATTEMPTS`, default 3). Timeouts — which already consumed a full
  request budget — retry once. This prevents a single transient blip from failing a whole
  turn, which matters most for multi-step turns (like a move) where every tool round-trip
  is another chance to fail.
- **Error mapping.** Provider errors are normalized to a small code set
  (`unauthorized`, `bad_request`, `rate_limited`, `timeout`, `unavailable`,
  `malformed_response`, …) and surfaced as distinct, non-leaking messages: a rate limit
  or timeout is worth retrying shortly, whereas a misconfiguration is not the user's to
  solve.
- **Payload size.** The 36-tool schema plus transcript is sizable (~6–7k prompt tokens
  per call). Trimming tool descriptions and reducing round-trips are tracked in the
  Roadmap as a reliability improvement.

### Configuration

All Mark variables are **server-only** (no `NEXT_PUBLIC_` prefix) and are documented with
their defaults in `env.example`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MARK_LLM_PROVIDER` | `nvidia` | Primary provider (`nvidia` or `groq`) |
| `NVIDIA_API_KEY` / `GROQ_API_KEY` | — | Provider keys; at least one is required |
| `NVIDIA_MODEL` / `GROQ_MODEL` | see `env.example` | Model id per provider |
| `NVIDIA_API_BASE` / `GROQ_API_BASE` | see `env.example` | Base URL per provider |
| `NVIDIA_TIMEOUT_MS` / `GROQ_TIMEOUT_MS` | `30000` | Per-request timeout |
| `MARK_PROVIDER_MAX_ATTEMPTS` | `3` | Retries per provider for recoverable failures |
| `MARK_APPROVAL_TTL_MINUTES` | `5` | Approval card validity (1–60) |
| `MARK_MAX_TOOL_STEPS` | `8` | Max model↔tool round trips per turn |
| `MARK_MAX_CONTEXT_CHARS` | `60000` | Transcript size ceiling |
| `MARK_BULK_OPERATION_THRESHOLD` | `5` | Above this, an operation needs a preview |
| `MARK_HIGH_RISK_OPERATION_THRESHOLD` | `25` | Above this, treated as destructive |
| `MARK_MAX_RESOURCES_PER_OPERATION` | `200` | Hard cap a single approval may touch |
| `MARK_EXPOSE_DENIALS` | `false` | Whether denial reasons are surfaced verbatim |

### What Mark stores

Mark keeps no durable state of its own. Approvals and the audit trail are **in-memory**
for the current session by design: a failed audit write must never obscure a successful
mutation, and an audit log in Firestore would need new rules and a new collection. All
durable data Mark touches is the ordinary Firestore data, written under the user's own
session and governed by `firestore.rules`.

> Mark-created tasks write an explicit `assigneeId`/`assigneeName` mirror (in addition to
> `assigneeIds`/`assigneeNames`) so a task is valid under both the legacy single-assignee
> shape and the current multi-assignee rules.

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4 (PostCSS), CSS Animations |
| **Drag & Drop** | dnd-kit (`@dnd-kit/core`, `sortable`, `utilities`) |
| **Icons** | Lucide React, Heroicons |
| **Auth** | Firebase Authentication (Google OAuth) |
| **Database** | Cloud Firestore (Real-time listeners) |
| **AI Agent (Mark)** | NVIDIA NIM (`nvidia/nemotron-3-ultra-550b-a55b`) + Groq (`qwen/qwen3.8-27b`) via a server-only OpenAI-compatible client, with tool calling |
| **Server auth (Mark)** | `node:crypto` RS256 Firebase ID-token verification (no `firebase-admin`) |
| **Markdown** | react-markdown + remark-gfm (sanitised renderer) |
| **Notifications** | React Hot Toast, Custom Notification Service |
| **Fonts** | Geist Sans & Geist Mono (Google Fonts) |
| **Testing** | Node `node:test` + tsx (Mark units), Mocha + `@firebase/rules-unit-testing` (rules) |
| **Deployment** | Vercel |

## 📁 Project Structure

```bash
tasky/
├── public/
│   ├── tasky.svg
│   ├── mark.svg                          # Mark avatar / launcher icon
│   ├── mark-design.png
│   └── ...
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── page.tsx                      # Landing page (marketing + auth)
│   │   ├── layout.tsx                    # Root layout + providers + MarkLauncher
│   │   ├── globals.css                   # Global styles + animations
│   │   ├── api/
│   │   │   └── mark/route.ts             # Server-only LLM proxy (holds provider keys)
│   │   ├── mark/
│   │   │   └── page.tsx                  # Mark chat page (timeline + approvals)
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Dashboard (workspaces, stats, notifications)
│   │   └── workspace/
│   │       └── [workspaceId]/
│   │           ├── page.tsx              # Workspace view (boards list)
│   │           ├── settings/
│   │           │   └── members/page.tsx  # Members list, roles, add/remove
│   │           └── board/
│   │               └── [boardId]/page.tsx # Kanban board view + task modal host
│   ├── mark/                             # Mark agent (client + server, no keys in browser)
│   │   ├── orchestrator.ts               # Turn loop, approvals, audit, dedupe
│   │   ├── conversation.ts               # Short-term transcript + focus context
│   │   ├── client.ts                     # Browser client for /api/mark
│   │   ├── protocol.ts                   # Wire contract (request/response types)
│   │   ├── resolve.ts                    # Server-validated resource resolution
│   │   ├── audit.ts                      # In-memory, redacted audit trail
│   │   ├── config.ts                     # Client-safe limits (no secrets)
│   │   ├── types.ts
│   │   ├── policy/
│   │   │   ├── scopeGuard.ts             # Deterministic Tasky-only scope + injection guard
│   │   │   ├── authorize.ts              # Tool → permission map (reuses lib/permissions)
│   │   │   ├── risk.ts                   # Risk classification (catalog + size)
│   │   │   ├── preview.ts                # "What exactly will change" approval bundles
│   │   │   └── approvals.ts              # User-bound, single-use, expiring approvals
│   │   ├── prompts/systemPrompt.ts       # Server-owned system prompt
│   │   ├── providers/
│   │   │   ├── registry.ts               # Provider chain, failover + retries
│   │   │   ├── openaiCompatible.ts       # Shared OpenAI-compatible transport
│   │   │   ├── nvidia.ts / groq.ts       # Concrete providers
│   │   │   ├── errors.ts                 # Normalized, retryable error codes
│   │   │   ├── verifyToken.ts            # RS256 Firebase ID-token verification
│   │   │   └── types.ts
│   │   ├── server/auth.ts                # Bearer-token gate for the route
│   │   └── tools/
│   │       ├── definitions.ts            # The single tool allowlist (36 tools)
│   │       ├── executors.ts              # Tool implementations (run as the user)
│   │       ├── validate.ts               # JSON-schema argument validation
│   │       └── types.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx               # Firebase auth state management
│   │   └── WorkspaceRoleContext.tsx      # Resolves the current user's role
│   ├── hooks/
│   │   ├── useTaskComments.ts            # Comment subscription + mutations
│   │   ├── useTaskAttachments.ts         # Attachment metadata state
│   │   └── useTaskLinks.ts               # Link list state
│   ├── lib/
│   │   ├── firebase.ts                   # Firebase initialization
│   │   ├── services.ts                   # Firestore CRUD (workspaces, members, boards, tasks, users, stats, search)
│   │   ├── permissions.ts                # Role → permission matrix (mirrors rules)
│   │   ├── memberErrors.ts               # Typed member-management errors
│   │   ├── userEmailIndex.ts             # Hash, resolve and publish user emails
│   │   ├── notificationService.ts        # Enhanced notification system
│   │   ├── taskOrder.ts                  # Sparse task ordering + rebalancing
│   │   ├── taskArchive.ts                # Archive/restore helpers + 90-day clock
│   │   ├── taskCleanupService.ts         # Expiry sweep foundation (not scheduled)
│   │   ├── commentService.ts             # Comment CRUD (Firestore only)
│   │   ├── attachmentService.ts          # Attachment metadata CRUD
│   │   ├── linkService.ts                # External link CRUD
│   │   ├── linkValidation.ts             # URL normalisation + validation
│   │   ├── fileValidation.ts             # Attachment extension/size rules
│   │   ├── storageService.ts             # Object-store boundary (S3 plugs in here)
│   │   ├── datetime.ts                   # Date formatting helpers
│   │   └── services_new.ts               # (Backup/alternative services)
│   ├── components/
│   │   ├── CreateModal.tsx               # Create workspace modal
│   │   ├── CreateBoardModal.tsx          # Create board modal
│   │   ├── AddMemberModal.tsx            # Add member by email + role
│   │   ├── EditWorkspaceModal.tsx        # Edit workspace modal
│   │   ├── EditBoardModal.tsx            # Edit board modal
│   │   ├── DeleteConfirmationModal.tsx
│   │   ├── KanbanBoard.tsx               # DnD context, read-only aware
│   │   ├── KanbanColumn.tsx              # Column + drop target
│   │   ├── TaskCard.tsx                  # Sortable card
│   │   ├── ArchivedTasksPanel.tsx        # Archived list, restore, delete
│   │   ├── NotificationPopup.tsx         # Toast-style notifications
│   │   ├── NotificationDrawer.tsx        # Notification side panel
│   │   ├── NotificationCard.tsx          # Individual notification card
│   │   ├── SearchResults.tsx             # Search dropdown results
│   │   ├── mark/
│   │   │   └── MarkLauncher.tsx          # Floating "Ask Mark" entry point
│   │   └── task/                         # Task detail modal + sub-sections
│   │       ├── TaskDetailModal.tsx       # Trello-style task dialog
│   │       ├── AssigneePicker.tsx        # Multi-assignee picker (max 5)
│   │       ├── CommentSection.tsx        # Comment thread
│   │       ├── CommentComposer.tsx       # New/edit comment box
│   │       ├── CommentItem.tsx           # One comment row
│   │       ├── Markdown.tsx              # Sanitising Markdown renderer
│   │       ├── AttachmentSection.tsx     # Files + links area
│   │       ├── AttachmentDropzone.tsx    # Upload control (disabled w/o storage)
│   │       ├── AttachmentRow.tsx         # One file row
│   │       ├── AttachmentImagePreview.tsx
│   │       ├── LinkList.tsx              # External links list
│   │       ├── LinkDialog.tsx            # Add/edit link dialog
│   │       ├── LinkRow.tsx               # One link row
│   │       └── ConfirmDialog.tsx         # Shared confirm dialog
│   └── types/
│       └── index.ts                      # TypeScript interfaces
├── tests/
│   ├── firestore.rules.test.js           # Security-rules tests (emulator)
│   └── mark/                             # Mark unit tests (node:test + tsx)
│       ├── authorize.test.ts
│       ├── approvals.test.ts
│       ├── risk.test.ts
│       ├── scopeGuard.test.ts
│       ├── validate.test.ts
│       ├── executors.test.ts
│       ├── orchestrator.test.ts
│       └── providers.test.ts             # Provider failover + retry policy
├── scripts/
│   └── migrate-workspace-members.mjs     # Optional owner-membership backfill
├── docs/
│   └── v2-phase1-architecture.md         # Collaboration/archive/storage design
├── firestore.rules                       # Firestore security rules
├── firestore.indexes.json                # Composite indexes for queries
├── firebase.json                         # Firebase hosting config
├── env.example                           # Environment variables template
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
├── tsconfig.json
├── next.config.ts
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
   git clone https://github.com/Krishna-Mawar18/tasky.git
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a Firebase project** and enable:
   - **Authentication** → Google provider
   - **Firestore Database**

4. **Configure environment variables**

   ```bash
   copy env.example .env.local
   ```

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

   **To use Mark**, also add at least one provider key (server-only, no `NEXT_PUBLIC_`
   prefix). `env.example` lists every `MARK_*` / provider variable with its default:

   ```env
   MARK_LLM_PROVIDER=nvidia
   NVIDIA_API_KEY=your_nvidia_key      # primary where configured
   GROQ_API_KEY=your_groq_key          # fallback where configured
   ```

   Without at least one key the rest of the app still works; Mark reports itself as
   not configured. Never commit real keys.

5. **Deploy Firestore indexes** (required for queries)

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:indexes
   ```

6. **Deploy Firestore rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

7. **Run the development server**

   ```bash
   npm run dev
   ```

8. **Open** [http://localhost:3000](http://localhost:3000)

> No object-storage environment variables exist yet. File attachments are metadata only
> until an S3 provider is registered (see Roadmap).

## 🔐 Workspaces, Members & Security Rules

### Roles

| Capability | Owner | Manager | Viewer |
|---|:---:|:---:|:---:|
| View workspace, boards, tasks, members | ✅ | ✅ | ✅ |
| Create / edit / delete boards | ✅ | ✅ | ❌ |
| Create / edit / delete tasks | ✅ | ✅ | ❌ |
| Move tasks (drag and drop) | ✅ | ✅ | ❌ |
| Archive / restore / permanently delete tasks | ✅ | ✅ | ❌ |
| Add members | ✅ | ❌ | ❌ |
| Change a member's role | ✅ | ❌ | ❌ |
| Remove a member | ✅ | ❌ | ❌ |
| Edit or delete the workspace | ✅ | ❌ | ❌ |
| Read & post comments | ✅ | ✅ | ✅ |
| Edit own comment | ✅ | ✅ | ✅ |
| Delete any comment | ✅ | ❌ | ❌ |
| Read links | ✅ | ✅ | ✅ |
| Add / edit own link | ✅ | ✅ | ❌ |
| Delete any link | ✅ | ❌ | ❌ |
| Read attachments | ✅ | ✅ | ✅ |
| Upload / delete own attachment | ✅ | ✅ | ❌ |
| Delete any attachment | ✅ | ❌ | ❌ |

There is exactly one owner per workspace. Ownership cannot be transferred, the
owner's membership cannot be deleted or demoted, and `owner` is not an assignable
role when adding or updating a member.

Viewer comment access is intentional: a viewer may join the discussion without
gaining any task-editing capability. Attachment uploads are manager-and-above, and
every capability above is mirrored in `src/lib/permissions.ts` and `firestore.rules`.

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
- **Comments** — any member may read and create; `authorId` is bound to the auth
  token; edits are limited to the author and may touch only content; only the
  workspace owner may delete someone else's comment
- **Attachments** — metadata is readable by any member; written by manager-and-
  above with an immutable `uploadedBy` and a server-reconstructed `s3Key`;
  deletions follow comment-style ownership (own, or owner-any)
- **Links** — readable by any member; addable by manager-and-above; `url` must be
  `http(s)` and 1..2048 chars; `createdBy`/`createdAt` pinned; creator or owner
  may delete
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
| `notifications` | `where('userId', '==', uid)` |
| `comments` / `attachments` / `links` | read via the parent `tasks/{taskId}` document |

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

| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run test:mark` | Run Mark unit tests (`node:test` + tsx, no emulator) |
| `npm run test:rules` | Run Firestore security-rules tests in the emulator |

## 🧪 Testing

There are two suites, and they cover different failure modes.

### Security rules (emulator)

Security rules are tested directly against the Firestore emulator, because a bug
there is invisible to typechecking and to the UI. The suite (71 cases across 6
suites in `tests/firestore.rules.test.js`) covers workspace/member/task/comment/
attachment/link access for owners, managers, viewers and outsiders, including the
unassigned-task update/move cases that back the RBAC regression fixes.

```bash
npm run test:rules
```

This spins up a disposable emulator (`--only firestore`), runs Mocha against
`firestore.rules`, and tears it down.

### Mark (unit, no network)

Mark's policy and orchestration are pure functions, so they are tested without a
provider or a database. The suite (50 cases across 8 files in `tests/mark/`) covers:

| File | Covers |
|------|--------|
| `authorize.test.ts` | Tool → role permission matrix, workspace-agnostic tools |
| `approvals.test.ts` | User-bound, single-use, expiring, de-duplicated approvals |
| `risk.test.ts` | Catalog risk, bulk thresholds, high-risk escalation |
| `scopeGuard.test.ts` | Tasky-only scope and instruction-extraction refusals |
| `validate.test.ts` | JSON-schema argument validation |
| `executors.test.ts` | Executor behaviour as the verified user |
| `orchestrator.test.ts` | The full turn loop: scope, tools, approvals, dedupe, errors |
| `providers.test.ts` | Provider failover and the retry/backoff policy |

```bash
npm run test:mark
```

There is no React/DOM test runner in the project yet; UI is verified manually.

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
  columns: BoardColumn[];  // Default: To Do, In Progress, Done
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
  assigneeId?: string;        // mirror of assigneeIds[0]; legacy/primary
  assigneeName?: string;
  assigneeIds?: string[];     // every assignee (max 5), workspace members only
  assigneeNames?: string[];   // parallel to assigneeIds
  dueDate?: Date | null;
  tags: string[];
  columnId: string;
  boardId: string;
  workspaceId: string;        // access is decided from this
  order: number;              // sparse position within the column
  archived?: boolean;         // absent = not archived
  archivedAt?: Date | null;
  archivedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Comment / Attachment / Link

```typescript
interface Comment {
  id: string;
  uid: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;            // Markdown
  createdAt: Date;
  updatedAt: Date;
}

interface Attachment {
  id: string;
  workspaceId: string;
  boardId: string;
  name: string;               // original filename
  size: number;
  contentType: string;
  s3Key: string;              // object key, never a URL
  uploadedBy: string;
  createdAt: Date;
}

interface Link {
  id: string;
  createdBy: string;
  createdByName: string;
  title: string;
  url: string;                // absolute http(s) only
  hostname: string;
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

### Mark (Manager Agent)

- The orchestrator (`src/mark/orchestrator.ts`) owns the turn loop; the model only
  proposes tool calls, which are authorized and executed locally under the user's session
- Provider keys live only in `/api/mark`; the browser never sees them
- Approvals and the audit trail are in-memory and session-scoped
- See [Mark — the Tasky Manager Agent](#-mark-the-tasky-manager-agent) for the full design

### Real-time Updates

- Uses `onSnapshot` listeners for workspaces, boards, tasks and notifications
- Comments, attachments and links subscribe to their own subcollections
- Automatic UI sync across browser tabs
- Cleanup on component unmount

### Optimistic UI

- Task creation, moves, edits, deletes update UI immediately
- Background Firestore writes with per-task rollback on error
- A monotonic sequence number per task prevents a slow write from clobbering a newer drag

### Task Ordering

- Sparse numeric scale (1000, 2000, 3000, …) so a drop between two tasks writes one document
- `resolveTaskPlacement` computes the minimal set of updates; rebalancing when the gap closes
- Documents written before ordering existed are migrated quietly in the background

### Archiving & Retention

- Archiving sets `archived: true`, `archivedAt` and `archivedBy`; the document never moves
- The board derives `activeTasks` / `archivedTasks` from the one fetched array
- Restore returns a task to its original column, falling back to the first column
- `taskCleanupService` implements the 90-day sweep but nothing calls it yet

### Storage Boundary

- `src/lib/storageService.ts` defines `AttachmentStorageProvider`
  (`isAvailable`, `uploadAttachment`, `getDownloadUrl`, `deleteAttachments`)
- The only registered provider refuses every operation, so the UI says "not configured"
  rather than pretending an upload succeeded
- `buildAttachmentObjectKey` is the single place an object key is built, from verified ids only
- Deletion reports `{ deleted, pending }` so an unreachable store never looks like success

### Deletion Cascade

- Permanent delete removes task comments, attachment metadata, links, then the task
- Returns a `TaskDeletionReport`; any storage keys that could not be removed are surfaced
- Firestore rules cannot cascade, so related subcollections are cleaned up explicitly

### Notification Deduplication

- Template-based notifications with variable substitution
- Duplicate prevention per template + metadata + time window

### Performance

- `useMemo`/`useCallback` for expensive computations
- Client-side sorting (avoids composite indexes for simple orders)
- Tasks grouped once per render rather than filtered per column
- Lazy-loaded modals and components

## 🎨 Customization

### Colors

Tailwind CSS 4 is configured in CSS. Edit the design tokens in `src/app/globals.css`
(the `:root` variables and the `@theme inline` block):

```css
:root {
  --background: #f8f8f6;
  --foreground: #1a1a1a;
  /* ... */
}

@theme inline {
  --color-background: var(--background);
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

### Mark says it "could not reach its model provider"

- **No/invalid key.** Confirm at least one of `NVIDIA_API_KEY` / `GROQ_API_KEY` is set
  in `.env.local` and matches the chosen `MARK_LLM_PROVIDER`. Mark reports itself as
  not configured (503) rather than pretending to work.
- **Transient provider overload.** Hosted endpoints return 5xx/429 under load; Mark
  retries with backoff and then fails over to the other provider. If you see this often,
  lower `MARK_PROVIDER_MAX_ATTEMPTS` does **not** help — raise it, or switch
  `MARK_LLM_PROVIDER` to the healthier provider.
- **Quoted values.** If you set keys in `.env.local`, do not wrap them in quotes; a
  stray quote is passed to the provider and reads as `401 Unauthorized`. Next.js strips
  surrounding quotes, but a raw script or probe will not.
- **A rate-limit or timeout message** is a different, transient signal — wait a moment
  and retry.

### Mark ignores a request or refuses it

The scope guard hard-refuses only clearly unrelated requests and instruction-extraction
attempts. Everything ambiguous is passed to the model, which is itself scoped by the
server system prompt. A request that is genuinely about Tasky but phrased obliquely may
need a rephrase.

## 🗺 Roadmap

### Platform

- [x] Drag-and-drop task reordering (dnd-kit)
- [x] Workspace members and Owner/Manager/Viewer roles
- [x] Task comments (Markdown) and multi-assignee
- [x] Task archiving, restore and permanent delete
- [x] External links on a task
- [x] Persist each user's email so members can be added by address
- [ ] **S3 attachment storage** (`S3AttachmentStorageProvider`) — upload, download, delete
- [ ] Inline image previews for jpg/jpeg/png once storage is connected
- [ ] Scheduled 90-day archive cleanup (Cloud Scheduler → Cloud Function)
- [ ] Task comments & @mentions notifications
- [ ] Email invitations (today a member must have signed in once)
- [ ] A React/DOM test runner for UI components

### Mark

- [x] Tool-calling manager agent with a server-only provider proxy
- [x] Deterministic scope guard, role-aware authorization and resource resolution
- [x] Destructive-action approvals (user-bound, single-use, expiring) with previews
- [x] Provider failover (NVIDIA → Groq) with normalized, non-leaking errors
- [x] Transient-failure retries with exponential backoff per provider
- [x] 50 Mark unit tests
- [ ] Trim the tool schema / round-trips to cut the ~6–7k-token floor per call
- [ ] Stream assistant tokens for a faster first paint
- [ ] Persist the audit trail (currently in-memory) behind new rules
- [ ] Optional write-tool coverage for members/roles (today read-only in Mark)
- [ ] Mark-triggered "@mention" notifications

## 🤝 Contributing

This is a learning project developed in phases. Each phase is completed and tested before moving to the next.

## 📄 License

MIT License - feel free to use for learning or as a starter.

---

Built with ❤️ using Next.js, Firebase, and Tailwind CSS.
