'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Database, Key, Settings } from 'lucide-react';

export default function FirebaseSetupGuide() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const steps = [
    {
      title: "1. Create Firebase Project",
      description: "Go to Firebase Console and create a new project",
      action: {
        text: "Open Firebase Console",
        url: "https://console.firebase.google.com/",
        icon: ExternalLink
      }
    },
    {
      title: "2. Enable Authentication",
      description: "Enable Google Sign-In in Authentication section",
      action: {
        text: "Enable Google Auth",
        url: "https://console.firebase.google.com/project/_/authentication/providers",
        icon: Key
      }
    },
    {
      title: "3. Create Firestore Database",
      description: "Create a Firestore database in test mode",
      action: {
        text: "Create Database",
        url: "https://console.firebase.google.com/project/_/firestore",
        icon: Database
      }
    },
    {
      title: "4. Get Configuration",
      description: "Copy your Firebase config to the environment file",
      action: {
        text: "Get Config",
        url: "https://console.firebase.google.com/project/_/settings/general",
        icon: Settings
      }
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-200 via-pink-100 to-yellow-100 rounded-full blur-3xl opacity-60 animate-blob1 z-0" />
      <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-gradient-to-br from-pink-200 via-blue-100 to-yellow-100 rounded-full blur-2xl opacity-50 animate-blob2 z-0" />
      
      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(86)].map((_, i) => (
          <div
            key={i}
            className="w-full h-0.5 border-t border-dashed border-gray-200 opacity-60 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
            style={{ position: 'absolute', top: `${i * 2.2}rem` }}
          />
        ))}
      </div>

      {/* Notebook spiral */}
      <div className="hidden md:block absolute left-0 top-0 h-full z-10">
        <div className="flex flex-col items-center h-full justify-center gap-6 pl-2 pr-4">
          {[...Array(73)].map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full bg-gray-300 border-2 border-gray-400 mb-2 animate-spiral" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-white/90 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <img src="/tasky_logo.svg" alt="Tasky Logo" className="w-10 h-10 transition-transform duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-2xl font-extrabold font-mono tracking-tight">Tasky</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12 animate-fadein">
          <div className="w-20 h-20 bg-black rounded-lg flex items-center justify-center mx-auto mb-6">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold font-mono mb-4">
            Firebase Setup Required
          </h1>
          <p className="text-xl text-gray-600 font-mono">
            Tasky needs Firebase to work. Let's get you set up in a few minutes!
          </p>
        </div>

        {/* Setup Steps */}
        <div className="space-y-6 mb-12">
          {steps.map((step, index) => (
            <div key={step.title} className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: `${0.1 * index}s` }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold font-mono mb-2">{step.title}</h3>
                  <p className="text-gray-600 font-mono mb-4">{step.description}</p>
                </div>
                <a
                  href={step.action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-sm hover:bg-gray-800 transition-colors flex items-center space-x-2"
                >
                  <step.action.icon className="w-4 h-4" />
                  <span>{step.action.text}</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Configuration Section */}
        <div className="bg-white/90 border border-gray-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-2xl font-bold font-mono mb-6">5. Add Configuration</h2>
          <p className="text-gray-600 font-mono mb-6">
            Create a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file in your project root and add your Firebase config:
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-mono text-sm">Environment Variables</span>
              <button
                onClick={() => copyToClipboard(`NEXT_PUBLIC_FIREBASE_API_KEY=${firebaseConfig.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${firebaseConfig.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${firebaseConfig.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${firebaseConfig.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${firebaseConfig.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${firebaseConfig.appId}`, 'env')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {copiedField === 'env' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <pre className="text-green-400 font-mono text-sm overflow-x-auto">
{`NEXT_PUBLIC_FIREBASE_API_KEY=${firebaseConfig.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${firebaseConfig.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${firebaseConfig.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${firebaseConfig.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${firebaseConfig.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${firebaseConfig.appId}`}
            </pre>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-bold font-mono text-yellow-800 mb-2">⚠️ Important Notes:</h3>
            <ul className="text-sm text-yellow-700 font-mono space-y-1">
              <li>• Replace the placeholder values with your actual Firebase config</li>
              <li>• Make sure to enable Firestore Database in test mode</li>
              <li>• Enable Google Authentication in Firebase Console</li>
              <li>• Restart your development server after adding the config</li>
            </ul>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 shadow-lg animate-fadein" style={{ animationDelay: '0.6s' }}>
          <h2 className="text-2xl font-bold font-mono mb-4 text-blue-900">🎉 You're Almost Done!</h2>
          <div className="space-y-3 text-sm font-mono">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-blue-800">Add your Firebase configuration</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
              <span className="text-purple-800">Restart the development server</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <span className="text-green-800">Start creating workspaces and boards!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadein { animation: fadein 0.8s ease-out; }
        @keyframes blob1 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.1) translateY(20px);} }
        .animate-blob1 { animation: blob1 8s ease-in-out infinite; }
        @keyframes blob2 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.05) translateY(-20px);} }
        .animate-blob2 { animation: blob2 10s ease-in-out infinite; }
        @keyframes spiral { 0% { box-shadow: 0 0 0 0 #bbb; } 50% { box-shadow: 0 0 8px 2px #bbb; } 100% { box-shadow: 0 0 0 0 #bbb; } }
        .animate-spiral { animation: spiral 2.5s infinite; }
      `}</style>
    </div>
  );
} 