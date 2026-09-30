# Tasky - Real-time Collaborative Task Management

A modern, full-stack task management web app built with Next.js 15, TypeScript, Tailwind CSS, and Firebase. Features real-time collaboration, Kanban boards, workspaces, notifications, and a beautiful animated UI.

## ✨ Features

### 🏢 Workspace Management

- Create, edit, and delete workspaces
- Custom colors and descriptions
- Real-time workspace listing with live updates
- Owner-based access control

### 📋 Board Management

- Create boards within workspaces
- Custom board colors and descriptions
- Default Kanban columns (To Do, In Progress, Done)
- Board listing with task counts and creation dates

### 🎯 Kanban Board (Drag-and-Drop Ready)

- Three-column layout: To Do → In Progress → Done
- Create tasks with title, description, priority, and due dates
- Priority levels: Low (Green), Medium (Yellow), High (Red)
- Optimistic UI updates for instant feedback
- Task editing and deletion with confirmation modals
- Move tasks between columns with forward/back buttons
- Due date tracking with visual indicators (Overdue, Today, Tomorrow, X days)

### 👤 User Authentication

- Google Sign-In via Firebase Authentication
- Automatic user profile creation in Firestore
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
│   │       │   └── board/
│   │       │       └── [boardId]/
│   │       │           └── page.tsx  # Kanban board view
│   │       └── ...
│   ├── contexts/
│   │   └── AuthContext.tsx           # Firebase auth state management
│   ├── lib/
│   │   ├── firebase.ts               # Firebase initialization
│   │   ├── services.ts               # Firestore CRUD (workspaces, boards, tasks, users)
│   │   ├── notificationService.ts    # Enhanced notification system
│   │   └── services_new.ts           # (Backup/alternative services)
│   ├── components/
│   │   ├── CreateModal.tsx           # Create workspace modal
│   │   ├── CreateBoardModal.tsx      # Create board modal
│   │   ├── EditWorkspaceModal.tsx    # Edit workspace modal
│   │   ├── EditBoardModal.tsx        # Edit board modal
│   │   ├── DeleteConfirmationModal.tsx
│   │   ├── NotificationPopup.tsx     # Toast-style notifications
│   │   ├── NotificationDrawer.tsx    # Notification side panel
│   │   ├── NotificationCard.tsx      # Individual notification card
│   │   └── SearchResults.tsx         # Search dropdown results
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   └── ...
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

## 🔐 Firestore Security Rules

The `firestore.rules` file includes rules for:

- **Users**: Read/write own profile
- **Workspaces**: Owner can read/write; create requires ownership
- **Boards**: Authenticated users (can be restricted further)
- **Tasks**: Authenticated users (can be restricted further)
- **Notifications**: Users can only access their own

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

## 📝 Available Scripts

| Command | Description |
|---------|-------------|

| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🏗 Data Model

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;           // Tailwind color class
  ownerId: string;
  members: string[];       // User UIDs
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
  workspaceId: string;
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

- [ ] Drag-and-drop task reordering (dnd-kit)
- [ ] Task comments & mentions
- [ ] Team invitations & roles (Admin/Member/Viewer)

## 🤝 Contributing

This is a learning project developed in phases. Each phase is completed and tested before moving to the next.

## 📄 License

MIT License - feel free to use for learning or as a starter.

---

Built with ❤️ using Next.js, Firebase, and Tailwind CSS.
