import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  selectedDriverId: string | null;
  setSelectedDriverId: (id: string | null) => void;
  isAdmin: boolean;
  isDispatcher: boolean;
  isCashier: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BOOTSTRAPPED_ADMIN_EMAIL = 'tayseerlogistic@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          const isBootstrapped = firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (isBootstrapped && data.role !== 'admin') {
              // Ensure primary owner is always admin
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              data.role = 'admin';
            }
            setProfile(data);
          } else {
            // First time user registration
            const initialRole: UserRole = isBootstrapped ? 'admin' : 'dispatcher';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: initialRole,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            if (isBootstrapped) {
              await setDoc(doc(db, 'admins', firebaseUser.uid), {
                email: firebaseUser.email,
                assignedAt: new Date().toISOString()
              });
            }
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error syncing user profile:", error);
          // Fallback local profile so UI doesn't freeze if network glitch
          setProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'dispatcher'
          });
        }
      } else {
        setProfile(null);
        setSimulatedRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setProfile(null);
      setSimulatedRole(null);
    } catch (err: any) {
      console.error("Sign Out Error:", err);
    }
  };

  const switchRole = (newRole: UserRole) => {
    // Only administrators are allowed to test/simulate other roles
    if (profile?.role === 'admin') {
      setSimulatedRole(newRole);
    }
  };

  const effectiveRole: UserRole = simulatedRole || profile?.role || 'driver';

  const value: AuthContextType = {
    user,
    profile,
    role: effectiveRole,
    loading,
    loginWithGoogle,
    logout,
    switchRole,
    selectedDriverId,
    setSelectedDriverId,
    isAdmin: effectiveRole === 'admin',
    isDispatcher: effectiveRole === 'admin' || effectiveRole === 'dispatcher',
    isCashier: effectiveRole === 'admin' || effectiveRole === 'cashier',
    isDriver: effectiveRole === 'driver',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
