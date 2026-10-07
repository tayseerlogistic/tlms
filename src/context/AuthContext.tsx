import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  usersList: UserProfile[];
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  selectedDriverId: string | null;
  setSelectedDriverId: (id: string | null) => void;

  // Role permissions
  isAdmin: boolean;
  isEditor: boolean;
  isOperator: boolean;
  isDispatcher: boolean;
  isCashier: boolean;
  isDriver: boolean;
  isViewer: boolean;
  canEdit: boolean;

  // Admin User Management
  addUser: (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    driverId?: string;
    driverName?: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (uid: string, updates: Partial<UserProfile>) => Promise<void>;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  updateUserStatus: (uid: string, status: 'active' | 'suspended') => Promise<void>;
  resetUserPassword: (uid: string, newPass: string) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MASTER_ADMIN_EMAIL = 'admin@tls.com';
const MASTER_ADMIN_DEFAULT_PASS = 'Admin@123';
const BACKUP_ADMIN_EMAIL = 'tayseerlogistic@gmail.com';

const LOCAL_STORAGE_USERS_KEY = 'tls_lms_users_directory_v2';
const LOCAL_STORAGE_SESSION_KEY = 'tls_lms_active_session_v2';

// Initial provisioned users directory with the master admin account
const INITIAL_USERS: UserProfile[] = [
  {
    uid: 'master-admin-tls',
    email: MASTER_ADMIN_EMAIL,
    name: 'Master Administrator',
    role: 'admin',
    status: 'active',
    password: MASTER_ADMIN_DEFAULT_PASS,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    notes: 'Primary Root Administrator Account'
  },
  {
    uid: 'demo-operator-1',
    email: 'operator@tls.com',
    name: 'Operations Dispatcher',
    role: 'operator',
    status: 'active',
    password: 'Operator@123',
    createdAt: '2026-01-02T00:00:00.000Z',
    createdBy: MASTER_ADMIN_EMAIL,
    notes: 'Daily Timetable and Manifest Operations'
  },
  {
    uid: 'demo-editor-1',
    email: 'editor@tls.com',
    name: 'Data & Fleet Editor',
    role: 'editor',
    status: 'active',
    password: 'Editor@123',
    createdAt: '2026-01-03T00:00:00.000Z',
    createdBy: MASTER_ADMIN_EMAIL,
    notes: 'Master Data & Fleet Records'
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Users Directory state
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_USERS;
  });

  // Sync users directory to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(usersList));
    } catch (e) {
      console.warn('Failed to cache users directory:', e);
    }
  }, [usersList]);

  // Sync active profile to localStorage session
  useEffect(() => {
    try {
      if (profile) {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      }
    } catch (e) {
      console.warn('Failed to sync session to localStorage:', e);
    }
  }, [profile]);

  // Listen to Firestore users collection
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const firestoreUsers: UserProfile[] = [];
        snapshot.forEach((d) => {
          firestoreUsers.push({ ...(d.data() as UserProfile), uid: d.id });
        });

        if (firestoreUsers.length > 0) {
          // Merge with master admin if not in firestore
          const hasMaster = firestoreUsers.some(u => u.email.toLowerCase() === MASTER_ADMIN_EMAIL);
          const merged = hasMaster
            ? firestoreUsers
            : [INITIAL_USERS[0], ...firestoreUsers];

          setUsersList(merged);

          // Update current profile if present in snapshot
          if (profile) {
            const currentInDb = firestoreUsers.find(u => u.uid === profile.uid || u.email.toLowerCase() === profile.email.toLowerCase());
            if (currentInDb) {
              setProfile(prev => prev ? { ...prev, ...currentInDb } : currentInDb);
            }
          }
        }
      }, (err) => {
        console.warn('Firestore users collection snapshot warning (using local directory):', err);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore onSnapshot error:', err);
    }
  }, [profile?.email]);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userEmail = (firebaseUser.email || '').toLowerCase();
        const isMasterAdmin =
          userEmail === MASTER_ADMIN_EMAIL.toLowerCase() ||
          userEmail === BACKUP_ADMIN_EMAIL.toLowerCase();

        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (isMasterAdmin && data.role !== 'admin') {
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              data.role = 'admin';
            }
            setProfile(data);
          } else {
            // Check if provisioned by admin in local users list
            const matchLocal = usersList.find(u => u.email.toLowerCase() === userEmail);
            const assignedRole: UserRole = isMasterAdmin ? 'admin' : (matchLocal?.role || 'operator');

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || matchLocal?.name || firebaseUser.email?.split('@')[0] || 'User',
              role: assignedRole,
              status: matchLocal?.status || 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await setDoc(userDocRef, newProfile);
            if (assignedRole === 'admin') {
              await setDoc(doc(db, 'admins', firebaseUser.uid), {
                email: firebaseUser.email,
                assignedAt: new Date().toISOString()
              });
            }
            setProfile(newProfile);
          }
        } catch (err) {
          console.warn('Syncing user profile error (using fallback profile):', err);
          if (!profile) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: isMasterAdmin ? 'admin' : 'operator',
              status: 'active'
            });
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [usersList]);

  // Email & Password Login
  const loginWithEmail = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    // 1. Check Master Admin Credentials
    const isMasterAdminEmail = cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase();
    if (isMasterAdminEmail) {
      // Find master admin record in list to check password
      const masterRecord = usersList.find(u => u.email.toLowerCase() === MASTER_ADMIN_EMAIL) || INITIAL_USERS[0];
      const expectedPass = masterRecord.password || MASTER_ADMIN_DEFAULT_PASS;

      if (cleanPass !== expectedPass) {
        return { success: false, error: 'Invalid password for Master Administrator (admin@tls.com).' };
      }

      // Valid master admin! Try Firebase Auth sign-in or create
      try {
        await signInWithEmailAndPassword(auth, MASTER_ADMIN_EMAIL, cleanPass);
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-login-credentials') {
          try {
            await createUserWithEmailAndPassword(auth, MASTER_ADMIN_EMAIL, cleanPass);
          } catch (createErr) {
            console.warn('Firebase Auth user creation note:', createErr);
          }
        }
      }

      const adminProfile: UserProfile = {
        uid: auth.currentUser?.uid || 'master-admin-tls',
        email: MASTER_ADMIN_EMAIL,
        name: masterRecord.name || 'Master Administrator',
        role: 'admin',
        status: 'active',
        createdAt: masterRecord.createdAt || new Date().toISOString()
      };

      setProfile(adminProfile);
      setSimulatedRole(null);

      // Save to Firestore in background
      try {
        await setDoc(doc(db, 'users', adminProfile.uid), adminProfile, { merge: true });
        await setDoc(doc(db, 'admins', adminProfile.uid), { email: MASTER_ADMIN_EMAIL, assignedAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        console.warn('Firestore admin doc sync note:', e);
      }

      return { success: true };
    }

    // 2. Check Provisioned Users List
    const provisionedUser = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    if (provisionedUser) {
      if (provisionedUser.status === 'suspended') {
        return { success: false, error: 'Your account has been deactivated by the Administrator. Please contact admin@tls.com.' };
      }

      if (provisionedUser.password && provisionedUser.password !== cleanPass) {
        return { success: false, error: 'Incorrect password for ' + cleanEmail + '.' };
      }

      // Try Firebase Auth in parallel
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      } catch (e) {
        // Continue with provisioned user session
      }

      setProfile(provisionedUser);
      setSimulatedRole(null);
      return { success: true };
    }

    // 3. User does NOT exist in provisioned users list!
    // Since sign-up is locked, attempt Firebase Auth sign-in just in case
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (cred.user) {
        return { success: true };
      }
    } catch {
      // Intentionally reject
    }

    // Return strict locked signup message
    return {
      success: false,
      error: 'Account not found. Self-registration is locked. New accounts must be provisioned by the Administrator. Please contact admin@tls.com.'
    };
  };

  // Google Sign In
  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      throw err;
    }
  };

  // Sign Out
  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSimulatedRole(null);
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  };

  // Role switching for testing / simulation
  const switchRole = (newRole: UserRole) => {
    if (profile?.role === 'admin') {
      setSimulatedRole(newRole);
    }
  };

  // -------------------------------------------------------------
  // ADMIN USER MANAGEMENT METHODS
  // -------------------------------------------------------------

  const addUser = async (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    driverId?: string;
    driverName?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = userData.email.trim().toLowerCase();

    // Check if email already registered
    const exists = usersList.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: `User with email ${cleanEmail} already exists in the system.` };
    }

    const newUid = 'tls-user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const newUser: UserProfile = {
      uid: newUid,
      email: cleanEmail,
      name: userData.name.trim(),
      role: userData.role,
      status: 'active',
      password: userData.password,
      driverId: userData.driverId || undefined,
      driverName: userData.driverName || undefined,
      notes: userData.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: profile?.email || MASTER_ADMIN_EMAIL
    };

    // Update state & local storage
    const updatedList = [...usersList, newUser];
    setUsersList(updatedList);
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn(e);
    }

    // Try provisioning in Firestore
    try {
      await setDoc(doc(db, 'users', newUid), newUser);
      if (newUser.role === 'admin') {
        await setDoc(doc(db, 'admins', newUid), { email: cleanEmail, assignedAt: new Date().toISOString() });
      }
    } catch (err) {
      console.warn('Firestore doc creation note:', err);
    }

    // Try secondary Firebase App Auth provisioning
    try {
      const secondaryAppName = 'SecondaryAuthProvisioner';
      const secondaryApp = getApps().find(a => a.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, userData.password);
      await fbSignOut(secondaryAuth);
    } catch (authErr) {
      // Firebase auth provisioning optional (fallback to credential match)
      console.warn('Secondary auth provisioning note:', authErr);
    }

    return { success: true };
  };

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    const updatedList = usersList.map(u => {
      if (u.uid === uid) {
        return { ...u, ...updates, updatedAt: new Date().toISOString() };
      }
      return u;
    });
    setUsersList(updatedList);

    if (profile?.uid === uid) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }

    try {
      await updateDoc(doc(db, 'users', uid), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Firestore updateDoc note:', err);
    }
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    await updateUser(uid, { role: newRole });
    if (newRole === 'admin') {
      try {
        await setDoc(doc(db, 'admins', uid), { assignedAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        console.warn(e);
      }
    } else {
      try {
        await deleteDoc(doc(db, 'admins', uid));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const updateUserStatus = async (uid: string, status: 'active' | 'suspended') => {
    await updateUser(uid, { status });
  };

  const resetUserPassword = async (uid: string, newPass: string) => {
    await updateUser(uid, { password: newPass });
  };

  const deleteUser = async (uid: string) => {
    const target = usersList.find(u => u.uid === uid);
    if (target?.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new Error('The primary root administrator (admin@tls.com) cannot be deleted.');
    }

    const updated = usersList.filter(u => u.uid !== uid);
    setUsersList(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'admins', uid));
    } catch (e) {
      console.warn('Firestore deleteDoc note:', e);
    }
  };

  const effectiveRole: UserRole = simulatedRole || profile?.role || 'operator';

  const value: AuthContextType = {
    user,
    profile,
    role: effectiveRole,
    loading,
    usersList,
    loginWithEmail,
    loginWithGoogle,
    logout,
    switchRole,
    selectedDriverId,
    setSelectedDriverId,

    isAdmin: effectiveRole === 'admin',
    isEditor: effectiveRole === 'admin' || effectiveRole === 'editor',
    isOperator: effectiveRole === 'admin' || effectiveRole === 'operator' || effectiveRole === 'dispatcher',
    isDispatcher: effectiveRole === 'admin' || effectiveRole === 'dispatcher' || effectiveRole === 'operator',
    isCashier: effectiveRole === 'admin' || effectiveRole === 'cashier',
    isDriver: effectiveRole === 'driver',
    isViewer: effectiveRole === 'viewer',
    canEdit: effectiveRole === 'admin' || effectiveRole === 'editor' || effectiveRole === 'operator' || effectiveRole === 'cashier',

    addUser,
    updateUser,
    updateUserRole,
    updateUserStatus,
    resetUserPassword,
    deleteUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
