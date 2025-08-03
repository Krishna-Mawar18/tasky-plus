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

6. **Open your browser**
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

## Contributing

This project is being developed step by step. Each phase will be completed and tested before moving to the next.

## License

MIT License
