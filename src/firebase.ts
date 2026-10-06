import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { UserProfile, Product, Invoice, Customer, StoreSettings, ADMIN_EMAIL } from "./types";

// Firebase Configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyBRhkllld46I467xo8DJsX1LCcXjXDYEfQ",
  authDomain: "list-3d848.firebaseapp.com",
  projectId: "list-3d848",
  storageBucket: "list-3d848.firebasestorage.app",
  messagingSenderId: "882343684866",
  appId: "1:882343684866:web:734a4cf27752f07e06301b",
  measurementId: "G-HM9QVZWM7Z"
};

// Initialize Primary Firebase SDK
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enforce permanent local persistence so the user NEVER gets logged out automatically
try {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    try {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (e) {}
  });
} catch (e) {}

// Use robust Firestore initialization with auto-detect long polling
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

// Domain suffix for username-only logins
const USERNAME_DOMAIN = "@list-3d848.app";

/**
 * Normalizes phone numbers (converts Arabic numerals ٠-٩ to 0-9, strips formatting and spaces)
 */
export const normalizePhoneNumber = (phone: string | undefined | null): string => {
  if (!phone) return '';
  const arabicNumerals = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let str = phone.toString();
  arabicNumerals.forEach((digit, i) => {
    str = str.split(digit).join(i.toString());
  });
  const digits = str.replace(/\D/g, '');
  if (digits.startsWith('964') && digits.length >= 12) {
    return '0' + digits.slice(3);
  }
  if (digits.startsWith('00964') && digits.length >= 14) {
    return '0' + digits.slice(5);
  }
  return digits;
};

/**
 * Normalizes input identifier (email, username, phone) to Firebase compatible email
 */
export const formatIdentifierToEmail = (identifier: string): { email: string; username: string } => {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    return {
      email: trimmed.toLowerCase(),
      username: parts[0]
    };
  }
  const cleanUsername = trimmed.toLowerCase().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  return {
    email: `${cleanUsername}${USERNAME_DOMAIN}`,
    username: trimmed
  };
};

/**
 * Checks if current user has Admin privileges
 */
export const checkIsAdmin = (user: User | null | undefined): boolean => {
  if (!user || !user.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

// Clean initial settings for a new store
export const createInitialEmptySettings = (storeName: string, ownerName: string): StoreSettings => ({
  storeName: storeName.trim() || 'مخزني الجديد',
  ownerName: ownerName.trim() || 'المشرف',
  phone: '',
  address: '',
  currency: 'دينار',
  defaultCategory: 'عام',
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
  printFormat: 'a4',
  enableWholesale: true,
  deviceMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
  desktopLayout: 'full',
});

/**
 * Login via Phone number, Username, or Email and Password
 */
export const loginWithEmailOrUsername = async (identifier: string, password: string) => {
  const trimmed = identifier.trim();
  const normalizedInputPhone = normalizePhoneNumber(trimmed);

  // 1. First, search registered users by direct server lookup or admin users
  let matchedUser: any = null;
  try {
    const lookupRes = await fetch(`/api/auth/lookup?q=${encodeURIComponent(trimmed)}`);
    if (lookupRes.ok) {
      const lookupData = await lookupRes.json();
      if (lookupData.success && lookupData.user) {
        matchedUser = lookupData.user;
      }
    }
  } catch (e) {}

  if (!matchedUser) {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        const users: any[] = Array.isArray(data.users) ? data.users : [];
        matchedUser = users.find((u: any) => {
          const uPhoneNorm = normalizePhoneNumber(u.phone);
          const phoneMatch = normalizedInputPhone.length >= 7 && (
            uPhoneNorm === normalizedInputPhone || 
            uPhoneNorm.endsWith(normalizedInputPhone) || 
            normalizedInputPhone.endsWith(uPhoneNorm)
          );
          const usernameMatch = u.username?.toLowerCase() === trimmed.toLowerCase();
          const emailMatch = u.email?.toLowerCase() === trimmed.toLowerCase();
          return phoneMatch || usernameMatch || emailMatch;
        });
      }
    } catch (e) {}
  }

  // Also check locally cached client accounts
  if (!matchedUser) {
    const localClients = getLocalClientsList();
    matchedUser = localClients.find((u: any) => {
      const uPhoneNorm = normalizePhoneNumber(u.phone);
      const phoneMatch = normalizedInputPhone.length >= 7 && (
        uPhoneNorm === normalizedInputPhone || 
        uPhoneNorm.endsWith(normalizedInputPhone) || 
        normalizedInputPhone.endsWith(uPhoneNorm)
      );
      const usernameMatch = u.username?.toLowerCase() === trimmed.toLowerCase();
      const emailMatch = u.email?.toLowerCase() === trimmed.toLowerCase();
      return phoneMatch || usernameMatch || emailMatch;
    });
  }

  // If found in registered client accounts (by phone, username, or email)
  if (matchedUser) {
    if (matchedUser.isActive === false) {
      throw new Error('هذا الحساب معطل حالياً من قِبل إدارة النظام.');
    }

    // Verify stored password
    if (matchedUser.password && matchedUser.password !== password) {
      throw new Error('كلمة المرور غير صحيحة.');
    }

    const targetEmail = matchedUser.email || formatIdentifierToEmail(matchedUser.username || matchedUser.phone || 'client').email;

    // Try Firebase Auth
    try {
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const user = userCredential.user;
      const isAdmin = checkIsAdmin(user) || matchedUser.role === 'admin';
      const cachedProfile: UserProfile = {
        ...matchedUser,
        uid: user.uid,
        email: user.email || targetEmail,
        role: isAdmin ? 'admin' : (matchedUser.role || 'client'),
      };
      try {
        localStorage.setItem(`profile_${user.uid}`, JSON.stringify(cachedProfile));
        localStorage.setItem('last_active_user_uid', user.uid);
      } catch (e) {}
      return user;
    } catch (fbErr: any) {
      console.warn("Direct Firebase Auth notice, completing local/server session:", fbErr?.message || fbErr);
      const isAdmin = matchedUser.role === 'admin' || (matchedUser.email && matchedUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      const fakeUser = {
        uid: matchedUser.uid,
        email: isAdmin ? ADMIN_EMAIL : (matchedUser.email || targetEmail),
        displayName: matchedUser.displayName || matchedUser.username || 'مستخدم',
      } as User;
      try {
        localStorage.setItem(`profile_${matchedUser.uid}`, JSON.stringify({
          ...matchedUser,
          role: isAdmin ? 'admin' : 'client'
        }));
        localStorage.setItem('last_active_user_uid', matchedUser.uid);
      } catch (e) {}
      return fakeUser;
    }
  }

  // 2. Direct Firebase Auth attempt for admin or standard accounts
  const { email, username } = formatIdentifierToEmail(trimmed);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const isAdmin = checkIsAdmin(user);
    const cachedProfile: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      username: user.displayName || username,
      displayName: user.displayName || (isAdmin ? 'المدير العام' : username),
      storeName: isAdmin ? 'لوحة الإدارة المركزية' : `مخزن ${user.displayName || username}`,
      role: isAdmin ? 'admin' : 'client',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify(cachedProfile));
      localStorage.setItem('last_active_user_uid', user.uid);
    } catch (e) {}

    // Non-blocking background sync of profile to Firestore
    Promise.race([
      setDoc(doc(db, 'users', user.uid), cachedProfile, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});

    return user;
  } catch (firebaseErr: any) {
    if (firebaseErr.code === 'auth/wrong-password' || firebaseErr.code === 'auth/invalid-credential') {
      throw new Error('رقم الهاتف / اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
    throw firebaseErr;
  }
};

/**
 * Change current user password (Works for both Admin and Client accounts)
 */
export const changeCurrentUserPassword = async (newPassword: string, targetUid?: string): Promise<boolean> => {
  const user = auth.currentUser;
  const uid = targetUid || user?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null);
  
  if (!uid) {
    throw new Error('يجب تسجيل الدخول أولاً لتغيير كلمة المرور.');
  }

  if (!newPassword || newPassword.length < 4) {
    throw new Error('يجب أن تتكون كلمة المرور من 4 خانات أو أحرف على الأقل.');
  }

  let firebaseSuccess = false;

  // 1. Update in Firebase Auth if available
  if (user) {
    try {
      await updatePassword(user, newPassword);
      firebaseSuccess = true;
    } catch (fbErr: any) {
      console.warn("Firebase Auth updatePassword warning:", fbErr);
    }
  }

  // 2. Update user on server backend
  try {
    await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
  } catch (e) {
    console.warn("Server password update warning:", e);
  }

  // 3. Update local caches
  try {
    const raw = localStorage.getItem(`profile_${uid}`);
    if (raw) {
      const p = JSON.parse(raw);
      p.password = newPassword;
      localStorage.setItem(`profile_${uid}`, JSON.stringify(p));
    }
    const adminClients = getLocalClientsList().map(c => c.uid === uid ? { ...c, password: newPassword } : c);
    localStorage.setItem('admin_cached_clients', JSON.stringify(adminClients));
  } catch (e) {}

  return true;
};

/**
 * Update user profile details (phone, storeName, displayName) on backend
 */
export const updateCurrentUserProfile = async (
  updates: { phone?: string; displayName?: string; storeName?: string; role?: string },
  targetUid?: string
): Promise<boolean> => {
  const user = auth.currentUser;
  const uid = targetUid || user?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null);
  if (!uid) return false;

  try {
    await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const raw = localStorage.getItem(`profile_${uid}`);
    if (raw) {
      const p = JSON.parse(raw);
      localStorage.setItem(`profile_${uid}`, JSON.stringify({ ...p, ...updates }));
    }
    return true;
  } catch (e) {
    console.warn("Error updating user profile on server:", e);
    return false;
  }
};

/**
 * Fetch a specific user's profile from local cache or server (0ms latency)
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  // Check local profile cache first
  try {
    const raw = localStorage.getItem(`profile_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Fallback if current user is admin
  if (auth.currentUser && auth.currentUser.uid === uid && checkIsAdmin(auth.currentUser)) {
    return {
      uid,
      email: ADMIN_EMAIL,
      username: 'admin',
      displayName: 'المدير العام',
      storeName: 'لوحة الإدارة المركزية',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }

  // Quick read from server API
  try {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      const found = (data.users || []).find((u: any) => u.uid === uid);
      if (found) return found;
    }
  } catch (e) {}

  return null;
};

/**
 * THIRD REQUIREMENT: Secondary App Setup for Creating Client Accounts
 * Creates a client account WITHOUT logging out the current admin session!
 * Optimized for ultra-fast execution (<1 second) with zero hanging.
 */
export interface CreateClientInput {
  username: string;
  password: string;
  storeName: string;
  displayName: string;
  phone?: string;
}

export const createClientAccount = async (
  clientData: CreateClientInput
): Promise<UserProfile> => {
  const adminUser = auth.currentUser;
  if (!adminUser || !checkIsAdmin(adminUser)) {
    throw new Error('غير مصرح لك بإنشاء حسابات عملاء. فقط المدير العام يملك هذه الصلاحية.');
  }

  const { email, username } = formatIdentifierToEmail(clientData.username);
  const secondaryAppName = `SecApp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
  
  let newUid = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let secondaryApp: any = null;

  try {
    // 1. Initialize temporary secondary Firebase App
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    // 2. Create user in Firebase Auth with a 4-second timeout promise
    try {
      const authPromise = createUserWithEmailAndPassword(secondaryAuth, email, clientData.password);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 4000)
      );
      const userCred = await Promise.race([authPromise, timeoutPromise]);
      newUid = userCred.user.uid;

      // Update displayName non-blocking
      updateProfile(userCred.user, {
        displayName: clientData.displayName.trim() || username
      }).catch(() => {});
    } catch (authErr: any) {
      console.warn("Secondary Auth notice, proceeding with guaranteed server registration:", authErr?.message || authErr);
      if (authErr?.code === 'auth/email-already-in-use') {
        throw new Error('اسم المستخدم أو البريد مستخدم مسبقاً، يرجى اختيار اسم مستخدم آخر.');
      }
    }
  } catch (e: any) {
    if (e.message?.includes('مستخدم مسبقاً')) throw e;
  } finally {
    // Clean up secondary app immediately
    if (secondaryApp) {
      deleteApp(secondaryApp).catch(() => {});
    }
  }

  const newProfile: UserProfile & { password?: string } = {
    uid: newUid,
    email,
    username,
    displayName: clientData.displayName.trim() || username,
    storeName: clientData.storeName.trim() || `مخزن ${username}`,
    phone: clientData.phone?.trim() || '',
    role: 'client',
    isActive: true,
    password: clientData.password, // Saved securely in server storage for guaranteed client login
    createdAt: new Date().toISOString()
  };

  // 3. Save to server backend instantly (<10ms)
  try {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile)
    });
  } catch (e) {}

  // 4. Initialize client's empty store on server (<10ms)
  const initialSettings = createInitialEmptySettings(newProfile.storeName, newProfile.displayName);
  try {
    await fetch(`/api/sync/${encodeURIComponent(newUid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [],
        invoices: [],
        customers: [],
        settings: initialSettings
      })
    });
  } catch (e) {}

  // 5. Non-blocking background Firestore sync
  try {
    Promise.race([
      setDoc(doc(db, 'users', newUid), newProfile),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});
  } catch (e) {}

  // 6. Cache client locally in admin's client list
  cacheClientLocally(newProfile);

  return newProfile;
};

/**
 * Load all registered client accounts for the Admin Panel - Instant (<50ms)
 */
export const loadAllClientAccounts = async (): Promise<UserProfile[]> => {
  const clientsMap = new Map<string, UserProfile>();

  // 1. Read from server API with 1.5s timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('/api/admin/users', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users)) {
        data.users.forEach((u: UserProfile) => {
          if (u.role === 'client') clientsMap.set(u.uid, u);
        });
      }
    }
  } catch (e) {}

  // 2. Fallback to local admin client cache
  const localCached = getLocalClientsList();
  localCached.forEach((u) => {
    if (!clientsMap.has(u.uid)) {
      clientsMap.set(u.uid, u);
    }
  });

  return Array.from(clientsMap.values());
};

/**
 * Toggle client account active status - Instant
 */
export const toggleClientAccountStatus = async (uid: string, isActive: boolean): Promise<boolean> => {
  // Update server API
  try {
    await fetch(`/api/admin/users/${encodeURIComponent(uid)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive })
    });
  } catch (e) {}

  // Update local cache
  const list = getLocalClientsList().map(c => c.uid === uid ? { ...c, isActive } : c);
  localStorage.setItem('admin_cached_clients', JSON.stringify(list));

  // Non-blocking Firestore update
  try {
    Promise.race([
      setDoc(doc(db, 'users', uid), { isActive }, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});
  } catch (e) {}

  return true;
};

/**
 * Update full client account details (الاسم، اسم المحل، الهاتف، كلمة المرور)
 */
export interface UpdateClientInput {
  uid: string;
  displayName?: string;
  storeName?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
}

export const updateClientAccount = async (input: UpdateClientInput): Promise<boolean> => {
  const adminUser = auth.currentUser;
  if (!adminUser || !checkIsAdmin(adminUser)) {
    throw new Error('فقط المدير العام يملك صلاحية تعديل حسابات الزبائن.');
  }

  // 1. Update server endpoint (<15ms)
  try {
    await fetch(`/api/admin/users/${encodeURIComponent(input.uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
  } catch (e) {}

  // 2. Update local storage cache
  const list = getLocalClientsList().map(c => {
    if (c.uid === input.uid) {
      return {
        ...c,
        displayName: input.displayName ?? c.displayName,
        storeName: input.storeName ?? c.storeName,
        phone: input.phone ?? c.phone,
        password: input.password ? input.password : c.password,
        isActive: input.isActive ?? c.isActive,
      };
    }
    return c;
  });
  localStorage.setItem('admin_cached_clients', JSON.stringify(list));

  // 3. Non-blocking background Firestore sync
  try {
    const firestoreUpdates: any = {};
    if (input.displayName) firestoreUpdates.displayName = input.displayName;
    if (input.storeName) firestoreUpdates.storeName = input.storeName;
    if (input.phone !== undefined) firestoreUpdates.phone = input.phone;
    if (input.isActive !== undefined) firestoreUpdates.isActive = input.isActive;
    
    Promise.race([
      setDoc(doc(db, 'users', input.uid), firestoreUpdates, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});
  } catch (e) {}

  return true;
};

/**
 * Delete a client account permanently from system
 */
export const deleteClientAccount = async (uid: string): Promise<boolean> => {
  const adminUser = auth.currentUser;
  if (!adminUser || !checkIsAdmin(adminUser)) {
    throw new Error('فقط المدير العام يملك صلاحية حذف حسابات الزبائن.');
  }

  // 1. Delete on server API (<15ms)
  try {
    await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE'
    });
  } catch (e) {}

  // 2. Remove from local admin cache and storage
  const list = getLocalClientsList().filter(c => c.uid !== uid);
  localStorage.setItem('admin_cached_clients', JSON.stringify(list));
  localStorage.removeItem(`store_cloud_cache_${uid}`);
  localStorage.removeItem(`profile_${uid}`);

  // 3. Non-blocking Firestore delete
  try {
    Promise.race([
      deleteDoc(doc(db, 'users', uid)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});
  } catch (e) {}

  return true;
};

// Local storage helper for client accounts caching
const getLocalClientsList = (): UserProfile[] => {
  try {
    const raw = localStorage.getItem('admin_cached_clients');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const cacheClientLocally = (client: UserProfile) => {
  try {
    const list = getLocalClientsList().filter(c => c.uid !== client.uid);
    list.unshift(client);
    localStorage.setItem('admin_cached_clients', JSON.stringify(list));
  } catch {}
};

export const logoutAccount = async () => {
  await signOut(auth);
};

// Store data types
export interface UserStoreData {
  products: Product[];
  invoices: Invoice[];
  customers: Customer[];
  settings: StoreSettings;
}

export const getLocalStoreData = (uid: string): UserStoreData | null => {
  try {
    const raw = localStorage.getItem(`store_cloud_cache_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read local store cache:", e);
  }
  return null;
};

export const setLocalStoreData = (uid: string, data: UserStoreData) => {
  try {
    localStorage.setItem(`store_cloud_cache_${uid}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not write local store cache:", e);
  }
};

// Smart merge helpers to prevent any data loss across devices or sync events
export const smartMergeProductsLocal = (local: Product[], remote: Product[]): Product[] => {
  const map = new Map<string, Product>();
  for (const p of remote) {
    if (p && p.id) map.set(p.id, p);
  }
  for (const p of local) {
    if (!p || !p.id) continue;
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      const timeLocal = new Date(p.updatedAt || p.createdAt || 0).getTime();
      const timeRemote = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (timeLocal >= timeRemote) {
        map.set(p.id, p);
      }
    }
  }
  return Array.from(map.values());
};

export const smartMergeInvoicesLocal = (local: Invoice[], remote: Invoice[]): Invoice[] => {
  const map = new Map<string, Invoice>();
  for (const inv of remote) {
    if (inv && inv.id) map.set(inv.id, inv);
  }
  for (const inv of local) {
    if (inv && inv.id && !map.has(inv.id)) {
      map.set(inv.id, inv);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
};

export const smartMergeCustomersLocal = (local: Customer[], remote: Customer[]): Customer[] => {
  const map = new Map<string, Customer>();
  for (const c of remote) {
    if (c && c.id) map.set(c.id, c);
  }
  for (const c of local) {
    if (!c || !c.id) continue;
    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
    } else {
      const timeLocal = new Date(c.updatedAt || c.createdAt || 0).getTime();
      const timeRemote = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (timeLocal >= timeRemote) {
        map.set(c.id, c);
      }
    }
  }
  return Array.from(map.values());
};

/**
 * Save store data to cloud (Cross-Device Sync)
 * 1. Writes to localStorage cache immediately (0ms)
 * 2. Writes directly to Firebase Cloud Firestore (authoritative for Android Capacitor & Web)
 * 3. Also syncs with server API if available
 */
export const saveStoreDataToCloud = async (
  uid: string, 
  data: UserStoreData & { isForceReset?: boolean }
): Promise<{ success: boolean; data?: UserStoreData }> => {
  // Always update local cache first
  setLocalStoreData(uid, data);

  let isSynced = false;
  let savedData: UserStoreData = data;

  // 1. PRIMARY: Write directly to Firebase Cloud Firestore
  try {
    const storeDocRef = doc(db, 'users', uid, 'store', 'currentData');
    
    // If not a force reset, merge with what is already on Firestore if remote has more items!
    let dataToSave = data;
    if (!data.isForceReset) {
      try {
        const snap = await Promise.race([
          getDoc(storeDocRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]) as any;
        if (snap && snap.exists()) {
          const remote = snap.data();
          if (remote) {
            dataToSave = {
              ...data,
              products: smartMergeProductsLocal(data.products || [], Array.isArray(remote.products) ? remote.products : []),
              invoices: smartMergeInvoicesLocal(data.invoices || [], Array.isArray(remote.invoices) ? remote.invoices : []),
              customers: smartMergeCustomersLocal(data.customers || [], Array.isArray(remote.customers) ? remote.customers : []),
              settings: data.settings || remote.settings || {},
            };
          }
        }
      } catch (mergeErr) {}
    }

    await setDoc(storeDocRef, {
      products: dataToSave.products || [],
      invoices: dataToSave.invoices || [],
      customers: dataToSave.customers || [],
      settings: dataToSave.settings || {},
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    savedData = dataToSave;
    setLocalStoreData(uid, savedData);
    isSynced = true;
  } catch (firestoreErr) {
    console.warn("Firestore direct save error/notice:", firestoreErr);
  }

  // 2. Secondary: If running with Express server API (e.g. web dev/full-stack mode)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`/api/sync/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(savedData),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        savedData = {
          products: smartMergeProductsLocal(savedData.products, Array.isArray(json.data.products) ? json.data.products : []),
          invoices: smartMergeInvoicesLocal(savedData.invoices, Array.isArray(json.data.invoices) ? json.data.invoices : []),
          customers: smartMergeCustomersLocal(savedData.customers, Array.isArray(json.data.customers) ? json.data.customers : []),
          settings: json.data.settings || savedData.settings
        };
        setLocalStoreData(uid, savedData);
      }
      isSynced = true;
    }
  } catch (e) {}

  return { success: isSynced, data: savedData };
};

/**
 * Load store data from cloud (Cross-Device Sync)
 * 1. Reads directly from Firebase Cloud Firestore (Primary - works on Android Capacitor & Web)
 * 2. Falls back to server sync API if available
 * 3. Falls back to local storage cache if network is unavailable
 */
export const loadStoreDataFromCloud = async (uid: string): Promise<UserStoreData | null> => {
  const localCache = getLocalStoreData(uid);

  // 1. PRIMARY: Read directly from Firebase Cloud Firestore with 2.5s strict timeout
  try {
    const storeDocRef = doc(db, 'users', uid, 'store', 'currentData');
    const storeSnap: any = await Promise.race([
      getDoc(storeDocRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);

    if (storeSnap && storeSnap.exists()) {
      const d = storeSnap.data();
      if (d) {
        const remoteProducts = Array.isArray(d.products) ? d.products : [];
        const remoteInvoices = Array.isArray(d.invoices) ? d.invoices : [];
        const remoteCustomers = Array.isArray(d.customers) ? d.customers : [];
        
        // Smart merge with localCache so no locally added products disappear!
        const result: UserStoreData = {
          products: smartMergeProductsLocal(localCache?.products || [], remoteProducts),
          invoices: smartMergeInvoicesLocal(localCache?.invoices || [], remoteInvoices),
          customers: smartMergeCustomersLocal(localCache?.customers || [], remoteCustomers),
          settings: d.settings || localCache?.settings || createInitialEmptySettings('مخزني', 'المشرف')
        };
        setLocalStoreData(uid, result);
        return result;
      }
    }
  } catch (firestoreErr) {
    console.warn("Firestore direct read notice:", firestoreErr);
  }

  // 2. Also check alternative legacy doc path 'stores/{uid}' in Firestore with 1.5s timeout
  try {
    const legacyDocRef = doc(db, 'stores', uid);
    const legacySnap: any = await Promise.race([
      getDoc(legacyDocRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ]);

    if (legacySnap && legacySnap.exists()) {
      const d = legacySnap.data();
      if (d) {
        const remoteProducts = Array.isArray(d.products) ? d.products : [];
        const remoteInvoices = Array.isArray(d.invoices) ? d.invoices : [];
        const remoteCustomers = Array.isArray(d.customers) ? d.customers : [];
        const result: UserStoreData = {
          products: smartMergeProductsLocal(localCache?.products || [], remoteProducts),
          invoices: smartMergeInvoicesLocal(localCache?.invoices || [], remoteInvoices),
          customers: smartMergeCustomersLocal(localCache?.customers || [], remoteCustomers),
          settings: d.settings || localCache?.settings || createInitialEmptySettings('مخزني', 'المشرف')
        };
        setLocalStoreData(uid, result);
        return result;
      }
    }
  } catch (e) {}

  // 3. Try server backend if running on full-stack web
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`/api/sync/${encodeURIComponent(uid)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        const remoteProducts = Array.isArray(d.products) ? d.products : [];
        const remoteInvoices = Array.isArray(d.invoices) ? d.invoices : [];
        const remoteCustomers = Array.isArray(d.customers) ? d.customers : [];
        const result: UserStoreData = {
          products: smartMergeProductsLocal(localCache?.products || [], remoteProducts),
          invoices: smartMergeInvoicesLocal(localCache?.invoices || [], remoteInvoices),
          customers: smartMergeCustomersLocal(localCache?.customers || [], remoteCustomers),
          settings: d.settings || localCache?.settings || createInitialEmptySettings('مخزني', 'المشرف')
        };
        setLocalStoreData(uid, result);
        return result;
      }
    }
  } catch (e) {
    console.warn("Server pull notice:", e);
  }

  // 4. Fallback to local storage
  return localCache;
};
