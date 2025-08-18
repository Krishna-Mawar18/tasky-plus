# Tasky - Collaborative Task Management

A real-time collaborative task management web app built with Next.js, TypeScript, and Firebase. Organize your work with Kanban boards, manage workspaces, and collaborate with your team seamlessly.

## 🚀 Current Status: Full-Featured Application

This project has evolved into a complete task management solution with the following features:

### ✅ Completed Features

#### 🔐 Authentication & User Management
- **Firebase Google Authentication**: Secure sign-in with Google accounts
- **User Profiles**: Personalized user experience with profile management
- **Session Management**: Persistent login state across browser sessions

#### 🏢 Workspace Management
- **Create Workspaces**: Organize projects into separate workspaces
- **Workspace Dashboard**: Overview of all your workspaces
- **Workspace Settings**: Edit and manage workspace details
- **Member Management**: Invite and manage team members

#### 📋 Board & Task Management
- **Kanban Boards**: Visual task management with drag-and-drop functionality
- **Board Creation**: Create unlimited boards within workspaces
- **Task Management**: Create, edit, delete, and organize tasks
- **Task Details**: Rich task information with descriptions, due dates, and assignments
- **Column Management**: Customizable workflow columns (To Do, In Progress, Done, etc.)

#### 🔔 Notification System
- **Real-time Notifications**: Get notified about task assignments, updates, and mentions
- **Notification Center**: Centralized notification management with filtering
- **Notification Types**: Support for info, success, warning, and error notifications
- **Categories**: Organized by task, workspace, system, and reminder categories
- **Mark as Read/Delete**: Full notification management capabilities

#### 🔍 Search & Discovery
- **Global Search**: Search across workspaces, boards, and tasks
- **Smart Filtering**: Filter results by type, workspace, and other criteria
- **Quick Access**: Fast navigation to frequently used items

#### 📊 Analytics & Insights
- **Dashboard Statistics**: Overview of tasks, boards, and productivity metrics
- **Progress Tracking**: Visual indicators of project completion
- **Activity Feed**: Recent activities and updates

#### 🎨 User Experience
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Dark/Light Mode**: Adaptive theming for different preferences
- **Mobile Responsive**: Optimized for desktop, tablet, and mobile devices
- **Smooth Animations**: Enhanced user experience with fluid transitions

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4.x
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Icons**: Lucide React, Heroicons
- **Notifications**: React Hot Toast
- **State Management**: React Context API
- **Deployment**: Vercel-ready

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication and Firestore enabled

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
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Google Authentication in Authentication > Sign-in method
   - Enable Firestore Database
   - Get your Firebase configuration from Project Settings

4. **Configure environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and add your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

5. **Set up Firestore indexes**
   The app requires composite indexes for optimal performance. You can either:
   
   **Option A: Auto-create indexes (Recommended)**
   - Run the app and perform actions that trigger the queries
   - Firebase will provide direct links to create the required indexes
   - Click the provided links in the console to create indexes automatically
   
   **Option B: Deploy indexes manually**
   ```bash
   # Install Firebase CLI if you haven't already
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Initialize Firebase (choose Firestore when prompted)
   firebase init firestore
   
   # Deploy the indexes
   firebase deploy --only firestore:indexes
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
tasky/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page
│   │   ├── dashboard/                # User dashboard
│   │   │   └── page.tsx             # Main dashboard view
│   │   ├── workspace/               # Workspace routes
│   │   │   └── [workspaceId]/       # Dynamic workspace pages
│   │   │       ├── page.tsx         # Workspace overview
│   │   │       └── board/           # Board routes
│   │   │           └── [boardId]/   # Dynamic board pages
│   │   │               └── page.tsx # Kanban board view
│   │   ├── globals.css              # Global styles
│   │   └── layout.tsx               # Root layout
│   ├── components/                  # Reusable components
│   │   ├── CreateBoardModal.tsx     # Board creation modal
│   │   ├── CreateModal.tsx          # General creation modal
│   │   ├── DeleteConfirmationModal.tsx # Deletion confirmation
│   │   ├── EditWorkspaceModal.tsx   # Workspace editing
│   │   ├── NotificationCard.tsx     # Individual notification display
│   │   ├── NotificationPopup.tsx    # Notification center popup
│   │   ├── NotificationDrawer.tsx   # Notification drawer
│   │   ├── SearchResults.tsx        # Search results display
│   │   ├── SetupGuide.tsx          # Initial setup guide
│   │   └── FirebaseSetupGuide.tsx  # Firebase configuration guide
│   ├── contexts/
│   │   └── AuthContext.tsx          # Authentication context
│   ├── lib/
│   │   ├── firebase.ts              # Firebase configuration
│   │   ├── services.ts              # Core business logic services
│   │   ├── services_new.ts          # Enhanced service implementations
│   │   └── notificationService.ts   # Notification management
│   └── types/
│       └── index.ts                 # TypeScript type definitions
├── public/                          # Static assets
│   ├── tasky_logo.svg              # Application logo
│   └── ...                         # Other static files
├── firebase.json                    # Firebase configuration
├── firestore.rules                 # Firestore security rules
├── firestore.indexes.json          # Firestore indexes configuration
├── env.example                      # Environment variables template
├── package.json                     # Dependencies and scripts
└── README.md                        # This file
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🎯 Key Features Explained

### Kanban Board System
- **Drag & Drop**: Intuitive task movement between columns
- **Customizable Columns**: Create workflow stages that match your process
- **Real-time Updates**: See changes instantly across all team members
- **Task Details**: Rich task information with descriptions, assignments, and due dates

### Notification System
- **Smart Notifications**: Get notified about relevant activities
- **Filtering**: View all, unread, or read notifications
- **Action Links**: Quick navigation to related tasks and boards
- **Mark as Read**: Efficient notification management

### Workspace Management
- **Multi-Workspace Support**: Separate different projects and teams
- **Member Permissions**: Control access and collaboration levels
- **Workspace Analytics**: Track progress and productivity metrics

### Search & Discovery
- **Global Search**: Find anything across your entire workspace
- **Smart Suggestions**: Intelligent search recommendations
- **Quick Navigation**: Fast access to frequently used items

## 🐛 Troubleshooting

### Common Issues

**1. Hydration Mismatch Errors**
- This is usually caused by browser extensions (like Grammarly) modifying the DOM
- The app includes `suppressHydrationWarning={true}` to handle this gracefully
- These warnings don't affect functionality

**2. Firestore Index Errors**
- When you see "The query requires an index" errors:
  - Click the provided link in the error message to auto-create the index
  - Or use the Firebase CLI to deploy the indexes: `firebase deploy --only firestore:indexes`
  - Indexes may take a few minutes to build

**3. Firebase Configuration Issues**
- Ensure all environment variables are set in `.env.local`
- Check that Firebase Authentication and Firestore are enabled in your Firebase project
- Verify that your Firebase project ID matches the one in your config

**4. Authentication Issues**
- Make sure Google Sign-In is enabled in Firebase Authentication
- Check that your domain is added to the authorized domains list in Firebase
- For localhost development, ensure `localhost` is in the authorized domains

**5. Server Action Naming Issues**
- Function props in client components must end with "Action" for Next.js 15
- If you see serialization errors, ensure function props follow the naming convention

## 🚀 Deployment

The application is optimized for deployment on Vercel:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Vercel will automatically build and deploy your app

For other platforms, use:
```bash
npm run build
npm run start
```

## 🤝 Contributing

This project welcomes contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information about your problem

---

**Built with ❤️ using Next.js, TypeScript, and Firebase**#   t a s k y 
 
 #   D e p l o y m e n t   F i x  
 