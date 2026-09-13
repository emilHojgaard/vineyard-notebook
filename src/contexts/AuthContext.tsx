import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check for pending invitations when user logs in
        await processPendingInvitations(user);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const processPendingInvitations = async (user: FirebaseUser) => {
    if (!user.email) return;

    const normalizedEmail = user.email.toLowerCase();
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(invitationsQuery);
    
    // Process each pending invitation
    for (const inviteDoc of snapshot.docs) {
      const invitation = inviteDoc.data();
      const projectId = invitation.projectId;

      // Add user to project members
      const projectRef = doc(db, 'projects', projectId);
      const projectDoc = await getDoc(projectRef);
      
      if (projectDoc.exists()) {
        const currentMembers = projectDoc.data().members || [];
        if (!currentMembers.includes(user.uid)) {
          await updateDoc(projectRef, {
            members: [...currentMembers, user.uid],
          });
        }
      }

      // Mark invitation as accepted
      await deleteDoc(doc(db, 'invitations', inviteDoc.id));
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
      
      // Create user document in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        email: email.toLowerCase(),
        displayName,
      });
      
      // Process any pending invitations for this email
      await processPendingInvitations(userCredential.user);
    }
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
