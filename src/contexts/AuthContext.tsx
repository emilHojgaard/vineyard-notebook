import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

interface PendingInvitation {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  invitedBy: string;
}

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
        await loadPendingInvitations(user);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadPendingInvitations = async (user: FirebaseUser) => {
    if (!user.email) return;

    const normalizedEmail = user.email.toLowerCase();
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(invitationsQuery);
    
    // Load all pending invitations with project names
    const invitations: PendingInvitation[] = [];
    for (const inviteDoc of snapshot.docs) {
      const invitation = inviteDoc.data();
      const projectId = invitation.projectId;

      // Fetch project name
      const projectRef = doc(db, 'projects', projectId);
      const projectDoc = await getDoc(projectRef);
      
      if (projectDoc.exists()) {
        invitations.push({
          id: inviteDoc.id,
          projectId,
          projectName: projectDoc.data().name || 'Unknown Project',
          email: invitation.email,
          invitedBy: invitation.invitedBy,
        });
      }
    }

    setPendingInvitations(invitations);
  };

  const acceptInvitation = async (invitationId: string) => {
    if (!currentUser) return;

    const invitation = pendingInvitations.find(inv => inv.id === invitationId);
    if (!invitation) return;

    // Add user to project members
    const projectRef = doc(db, 'projects', invitation.projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (projectDoc.exists()) {
      const currentMembers = projectDoc.data().members || [];
      if (!currentMembers.includes(currentUser.uid)) {
        await updateDoc(projectRef, {
          members: [...currentMembers, currentUser.uid],
        });
      }
    }

    // Delete the invitation
    await deleteDoc(doc(db, 'invitations', invitationId));

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
    await deleteDoc(doc(db, 'invitations', invitationId));

    // Remove from local state
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
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
      
      // Load any pending invitations for this email
      await loadPendingInvitations(userCredential.user);
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
