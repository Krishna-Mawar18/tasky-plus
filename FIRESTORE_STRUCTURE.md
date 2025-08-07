# Firestore Database Structure - Tasky

## 📊 Collection Overview

Your Tasky application uses the following Firestore collections:

### 1. `workspaces` Collection
**Purpose**: Stores workspace/team information

**Document Structure**:
```typescript
{
  id: string,                    // Auto-generated document ID
  name: string,                  // Workspace name
  description?: string,          // Optional workspace description
  color: string,                 // Workspace color theme
  ownerId: string,               // User ID of workspace owner
  members: string[],             // Array of member user IDs
  createdAt: Date,               // Server timestamp
  updatedAt: Date                // Server timestamp
}
```

**Example Document**:
```json
{
  "id": "workspace_123",
  "name": "Marketing Team",
  "description": "All marketing related projects",
  "color": "#3B82F6",
  "ownerId": "user_456",
  "members": ["user_456", "user_789", "user_101"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:45:00Z"
}
```

### 2. `boards` Collection
**Purpose**: Stores Kanban boards within workspaces

**Document Structure**:
```typescript
{
  id: string,                    // Auto-generated document ID
  workspaceId: string,           // Reference to parent workspace
  name: string,                  // Board name
  description?: string,          // Optional board description
  columns: Column[],             // Array of board columns
  createdAt: Date,               // Server timestamp
  updatedAt: Date                // Server timestamp
}
```

**Column Structure**:
```typescript
{
  id: string,                    // Column ID
  name: string,                  // Column name (e.g., "To Do", "In Progress")
  order: number,                 // Column order/position
  tasks: Task[]                  // Array of tasks in this column
}
```

**Example Document**:
```json
{
  "id": "board_789",
  "workspaceId": "workspace_123",
  "name": "Q1 Campaign Planning",
  "description": "Planning for Q1 marketing campaigns",
  "columns": [
    {
      "id": "col_todo",
      "name": "To Do",
      "order": 1,
      "tasks": []
    },
    {
      "id": "col_progress",
      "name": "In Progress",
      "order": 2,
      "tasks": []
    },
    {
      "id": "col_done",
      "name": "Done",
      "order": 3,
      "tasks": []
    }
  ],
  "createdAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-20T15:00:00Z"
}
```

### 3. `tasks` Collection
**Purpose**: Stores individual tasks with full details

**Document Structure**:
```typescript
{
  id: string,                    // Auto-generated document ID
  title: string,                 // Task title
  description?: string,          // Optional task description
  status: 'todo' | 'in-progress' | 'completed',
  priority: 'low' | 'medium' | 'high',
  assigneeId?: string,           // User ID of assignee
  assigneeName?: string,         // Display name of assignee
  dueDate?: Date | null,         // Task due date
  tags: string[],                // Array of task tags
  createdAt: Date,               // Server timestamp
  updatedAt: Date,               // Server timestamp
  columnId: string,              // Reference to parent column
  boardId: string,               // Reference to parent board
  workspaceId: string            // Reference to parent workspace
}
```

**Example Document**:
```json
{
  "id": "task_456",
  "title": "Design new landing page",
  "description": "Create a modern landing page for the new product",
  "status": "in-progress",
  "priority": "high",
  "assigneeId": "user_789",
  "assigneeName": "John Doe",
  "dueDate": "2024-02-15T00:00:00Z",
  "tags": ["design", "frontend", "urgent"],
  "createdAt": "2024-01-15T12:00:00Z",
  "updatedAt": "2024-01-20T16:00:00Z",
  "columnId": "col_progress",
  "boardId": "board_789",
  "workspaceId": "workspace_123"
}
```

### 4. `notifications` Collection
**Purpose**: Stores user notifications

**Document Structure**:
```typescript
{
  id: string,                    // Auto-generated document ID
  userId: string,                // User ID who receives the notification
  title: string,                 // Notification title
  message: string,               // Notification message
  type: 'info' | 'success' | 'warning' | 'error',
  read: boolean,                 // Whether notification has been read
  createdAt: Date                // Server timestamp
}
```

**Example Document**:
```json
{
  "id": "notif_789",
  "userId": "user_456",
  "title": "Task Assigned",
  "message": "You have been assigned to 'Design new landing page'",
  "type": "info",
  "read": false,
  "createdAt": "2024-01-20T16:30:00Z"
}
```

## 🔗 Relationships

### Hierarchical Structure
```
workspaces/
├── workspace_123/
    └── boards/
        ├── board_789/
            └── tasks/
                ├── task_456/
                └── task_789/
```

### Key Relationships
- **Workspace → Boards**: One-to-many (workspaceId in boards)
- **Board → Tasks**: One-to-many (boardId in tasks)
- **Column → Tasks**: One-to-many (columnId in tasks)
- **User → Workspaces**: Many-to-many (members array in workspaces)
- **User → Tasks**: One-to-many (assigneeId in tasks)
- **User → Notifications**: One-to-many (userId in notifications)

## 🔍 Query Patterns

### Common Queries Used in Your App

1. **Get user's workspaces**:
   ```typescript
   query(collection(db, 'workspaces'), where('members', 'array-contains', userId))
   ```

2. **Get boards for a workspace**:
   ```typescript
   query(collection(db, 'boards'), where('workspaceId', '==', workspaceId))
   ```

3. **Get tasks for a board**:
   ```typescript
   query(collection(db, 'tasks'), where('boardId', '==', boardId))
   ```

4. **Get user's notifications**:
   ```typescript
   query(collection(db, 'notifications'), where('userId', '==', userId))
   ```

5. **Search across all collections**:
   ```typescript
   // Searches in workspaces, boards, and tasks
   // Implemented in services.ts searchAll function
   ```

## 🔒 Security Rules

### Development Rules (Current)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Production Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{workspaceId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.members;
    }
    match /boards/{boardId} {
      allow read, write: if request.auth != null;
    }
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

## 📈 Indexes Required

For optimal performance, ensure these composite indexes exist:

1. **workspaces**: `members` (array) + `updatedAt` (descending)
2. **boards**: `workspaceId` + `updatedAt` (descending)
3. **tasks**: `boardId` + `columnId`
4. **tasks**: `boardId` + `status`
5. **tasks**: `assigneeId` + `status`
6. **notifications**: `userId` + `read` + `createdAt` (descending)

## 🚀 Best Practices

1. **Use serverTimestamp()** for createdAt/updatedAt fields
2. **Implement real-time listeners** for collaborative features
3. **Use batch operations** for multiple related updates
4. **Implement proper error handling** for offline scenarios
5. **Use security rules** to enforce data access patterns
6. **Optimize queries** with proper indexes
7. **Use pagination** for large datasets

## 🔧 Current Implementation Status

✅ **Implemented**:
- Workspace CRUD operations
- Board CRUD operations  
- Task CRUD operations
- Real-time subscriptions
- Search functionality
- Notification system

🔄 **Ready for Production**:
- Security rules need to be updated
- Indexes should be created
- Error handling can be improved
- Offline support can be enhanced 