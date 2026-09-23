import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  acceptInvitation as acceptInvitationInRepository,
  declineInvitation as declineInvitationInRepository,
  loadPendingInvitations,
  saveUserProfile,
} from '../lib/repositories/auth-repository';
import type { PendingInvitation } from '../lib/repositories/auth-repository';

export interface InvitationNotification {
  id: string;
  message: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  pendingInvitations: PendingInvitation[];
  invitationNotifications: InvitationNotification[];
  dismissInvitationNotification: (notificationId: string) => void;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
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
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [invitationNotifications, setInvitationNotifications] = useState<InvitationNotification[]>([]);
  const notifiedInvitationIds = useRef(new Set<string>());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Load pending invitations when user logs in
        await loadUserPendingInvitations(user);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserPendingInvitations = async (user: FirebaseUser) => {
    if (!user.email) return;
    setPendingInvitations(await loadPendingInvitations(user.email));
  };

  const acceptInvitation = async (invitationId: string) => {
    if (!currentUser) return;

    const invitation = pendingInvitations.find(inv => inv.id === invitationId);
    if (!invitation) return;

    // Add user to project members and record when they joined. A transaction
    // avoids dropping a concurrent membership change.
    await acceptInvitationInRepository(invitation);

    // Remove from local state
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

    // An invitation can only be accepted once, but guard the notification as
    // well so auth/session reruns cannot show duplicate messages.
    if (!notifiedInvitationIds.current.has(invitation.id)) {
      notifiedInvitationIds.current.add(invitation.id);
      setInvitationNotifications(prev => [
        ...prev,
        {
          id: invitation.id,
          message: `You've been added to ${invitation.projectName}`,
        },
      ]);
    }
  };

  const dismissInvitationNotification = (notificationId: string) => {
    setInvitationNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };

  const declineInvitation = async (invitationId: string) => {
    // Delete the invitation without adding user to project
    await declineInvitationInRepository(invitationId);

    // Remove from local state
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
      
      await saveUserProfile(userCredential.user, email, displayName);
      // Load any pending invitations for this email
      await loadUserPendingInvitations(userCredential.user);
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
    pendingInvitations,
    invitationNotifications,
    dismissInvitationNotification,
    signup,
    login,
    logout,
    acceptInvitation,
    declineInvitation,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
