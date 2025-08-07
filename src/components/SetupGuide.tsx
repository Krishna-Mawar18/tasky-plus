'use client';

import React from 'react';

export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🚀 Welcome to Tasky!</h1>
          <p className="text-gray-400">Let's get your Firebase configuration set up</p>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Step 1: Create a Firebase Project</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-300">
              <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-blue-400 hover:text-blue-300">Firebase Console</a></li>
              <li>Click "Create a project" or "Add project"</li>
              <li>Enter a project name (e.g., "tasky-app")</li>
              <li>Follow the setup wizard (you can disable Google Analytics for now)</li>
            </ol>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Step 2: Get Your Firebase Config</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-300">
              <li>In your Firebase project, click the gear icon ⚙️ next to "Project Overview"</li>
              <li>Select "Project settings"</li>
              <li>Scroll down to "Your apps" section</li>
              <li>Click the web icon to add a web app</li>
              <li>Register your app with a nickname (e.g., "tasky-web")</li>
              <li>Copy the config object that looks like this:</li>
            </ol>
            <div className="mt-3 bg-gray-700 p-3 rounded text-sm font-mono text-gray-200">
              {`const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};`}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Step 3: Create Environment File</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-300">
              <li>In your project root, create a file called <code className="bg-gray-700 px-1 rounded text-gray-200">.env.local</code></li>
              <li>Copy the content from <code className="bg-gray-700 px-1 rounded text-gray-200">env.example</code></li>
              <li>Replace the placeholder values with your actual Firebase config:</li>
            </ol>
            <div className="mt-3 bg-gray-700 p-3 rounded text-sm font-mono text-gray-200">
              {`NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX`}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Step 4: Enable Google Authentication</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-300">
              <li>In Firebase Console, go to "Authentication" in the left sidebar</li>
              <li>Click "Get started"</li>
              <li>Go to the "Sign-in method" tab</li>
              <li>Click on "Google" provider</li>
              <li>Enable it and save</li>
            </ol>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Step 5: Restart Your App</h2>
            <p className="text-gray-300">
              After creating the <code className="bg-gray-700 px-1 rounded text-gray-200">.env.local</code> file, restart your development server:
            </p>
            <div className="mt-2 bg-gray-700 p-3 rounded text-sm font-mono text-gray-200">
              npm run dev
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Check out the <a href="https://firebase.google.com/docs/web/setup" target="_blank" rel="noopener noreferrer" className="underline text-blue-400 hover:text-blue-300">Firebase documentation</a>
          </p>
        </div>
      </div>
    </div>
  );
} 