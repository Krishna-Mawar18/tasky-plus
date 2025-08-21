# Tasky - Step by Step Development

A real-time collaborative task management web app built with Next.js, TypeScript, and Firebase.

## Current Status: Step 1 - Authentication

This project is being developed step by step. Currently, we have implemented:

### ✅ Completed Features
- **Landing Page**: Clean, modern landing page with Google Sign-In
- **Authentication**: Firebase Google Authentication
- **User Dashboard**: Basic dashboard showing user information
- **Navigation**: Simple navigation with sign-out functionality

### 🚧 Next Steps (Coming Soon)
- Workspace management
- Board creation and management
- Kanban board with drag-and-drop
- Real-time collaboration
- Role-based access control

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Authentication**: Firebase Authentication (Google)
- **Database**: Firebase Firestore (for future features)
- **Animations**: Framer Motion
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project

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
   - Enable Google Authentication
   - Get your Firebase configuration

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

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Set up Firestore indexes**
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

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
tasky/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/         # User dashboard
│   │   └── layout.tsx         # Root layout
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication context
│   ├── lib/
│   │   └── firebase.ts        # Firebase configuration
│   └── types/
│       └── index.ts           # TypeScript types
├── env.example                # Environment variables template
└── README.md                  # This file
```

## Development Roadmap

### Phase 1: Authentication ✅
- [x] Landing page
- [x] Google authentication
- [x] User dashboard
- [x] Sign out functionality

### Phase 2: Workspace Management (Next)
- [ ] Create workspaces
- [ ] Workspace listing
- [ ] Basic workspace navigation

### Phase 3: Board Management
- [ ] Create boards within workspaces
- [ ] Board listing
- [ ] Board navigation

### Phase 4: Kanban Board
- [ ] List creation
- [ ] Task creation
- [ ] Drag and drop functionality

### Phase 5: Collaboration
- [ ] Real-time updates
- [ ] User roles and permissions
- [ ] Invite system

## Troubleshooting

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

## Contributing

This project is being developed step by step. Each phase will be completed and tested before moving to the next.

## License

MIT License
