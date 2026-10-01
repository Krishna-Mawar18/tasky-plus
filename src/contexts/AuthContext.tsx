'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeEmail, upsertUserEmailIndex } from '@/lib/userEmailIndex';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isFirebaseConfigured: boolean;
  /**
   * Whether this account is discoverable by email address.
   *
   * `null` while it has not been checked yet, `false` when the entry could not be
   * published — which almost always means the security rules on the live project
   * do not include the `userEmailIndex` collection yet. Colleagues cannot be
   * added by email until this is `true` for the person being added.
   */
  emailIndexed: boolean | null;
  /** True while a manual retry is in flight. */
  emailIndexBusy: boolean;
  /** Re-publish this account's index entry on demand. */
  refreshEmailIndex: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailIndexed, setEmailIndexed] = useState<boolean | null>(null);
  const [emailIndexBusy, setEmailIndexBusy] = useState(false);
  const isFirebaseConfigured = !!auth;

  // The latest account, readable from the window event listeners below without
  // re-subscribing to auth on every sign-in.
  const userRef = useRef<User | null>(null);

  /**
   * Publish this account in the email lookup index.
   *
   * "Add a member by email" resolves against this index, so a refused write is
   * not a cosmetic problem: nobody can ever be added until it succeeds. The
   * result is reported rather than swallowed so the members page can say so, and
   * it is callable on demand because the write can fail for reasons that clear
   * on their own — most often the security rules not being deployed yet when
   * the tab was first opened.
   */
  const publishEmailIndex = useCallback(async (account: User) => {
    const email = normalizeEmail(account.email ?? '');
    if (!db || !email) {
      setEmailIndexed(null);
      return;
    }
    try {
      setEmailIndexed(
        await upsertUserEmailIndex({
          uid: account.uid,
          email,
          displayName: account.displayName,
          photoURL: account.photoURL,
        }),
      );
    } catch (error) {
      console.error('Error publishing user email index entry:', error);
      setEmailIndexed(false);
    }
  }, []);

  const refreshEmailIndex = useCallback(async () => {
    const account = userRef.current;
    if (!account?.email) return;
    setEmailIndexBusy(true);
    try {
      await publishEmailIndex(account);
    } finally {
      setEmailIndexBusy(false);
    }
  }, [publishEmailIndex]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (account) => {
      // Immediately set user and stop loading for fast UI response
      userRef.current = account;
      setUser(account);
      setLoading(false);
      if (!account) {
        setEmailIndexed(null);
        return;
      }

      // Handle Firestore operations in background (non-blocking)
      if (db && navigator.onLine) {
        const email = normalizeEmail(account.email ?? '');

        // The profile document and the email index are written independently:
        // a failure in one must not prevent the other, or a user could end up
        // findable by nobody. The index is what "add a member by email"
        // resolves against, so it is the write that matters most.
        try {
          const userRef = doc(db, 'users', account.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: account.uid,
              email,
              displayName: account.displayName,
              photoURL: account.photoURL,
              emailVerified: account.emailVerified,
              createdAt: new Date(),
              updatedAt: new Date(),
              workspaces: [], // Initialize empty workspaces array
              lastLogin: new Date(),
            });
          } else {
            // Update last login time
            await updateDoc(userRef, {
              lastLogin: new Date(),
              updatedAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Error setting up user profile:', error);
        }
      }

      if (account.email) {
        await publishEmailIndex(account);
      } else {
        console.warn('Signed-in account has no email address; skipping index entry.');
        setEmailIndexed(null);
      }
    });

    // A failed publish is usually transient: the page loaded while the rules had
    // not been deployed yet, or the device was briefly offline. Retrying when the
    // connection returns — and whenever the tab is brought back into view — means
    // nobody has to sign out and back in, or remember to reload, to become
    // findable by email. This is the difference between a person who can be added
    // and one who reports "no such account" forever.
    const handleOnline = () => {
      if (userRef.current) void publishEmailIndex(userRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userRef.current) {
        void publishEmailIndex(userRef.current);
      }
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [publishEmailIndex]);

  const signInWithGoogle = async () => {
    try {
      if (!auth || !googleProvider) {
        console.error('Firebase is not configured properly');
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const logout = async () => {
    try {
      if (!auth) {
        console.error('Firebase is not configured properly');
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout,
    isFirebaseConfigured,
    emailIndexed,
    emailIndexBusy,
    refreshEmailIndex,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 