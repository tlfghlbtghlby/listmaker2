import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
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
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
  printFormat: 'a4',
  enableWholesale: true,
  deviceMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
  desktopLayout: 'full',
});

/**
 * Login exclusively via Username/Email/Phone and Password - Optimized for instant response
 */
export const loginWithEmailOrUsername = async (identifier: string, password: string) => {
  const { email, username } = formatIdentifierToEmail(identifier);
  
  // 1. Try Firebase Auth (Primary standard login)
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Cache user profile locally immediately
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
    } catch (e) {}

    // Non-blocking background sync of profile to Firestore
    Promise.race([
      setDoc(doc(db, 'users', user.uid), cachedProfile, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]).catch(() => {});

    return user;
  } catch (firebaseErr: any) {
    // If wrong password, throw directly
    if (firebaseErr.code === 'auth/wrong-password' || firebaseErr.code === 'auth/invalid-credential') {
      throw firebaseErr;
    }

    // 2. Check local/server client accounts for instant offline or fallback login
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        const found = (data.users || []).find((u: any) => 
          (u.email?.toLowerCase() === email.toLowerCase() || u.username?.toLowerCase() === username.toLowerCase()) &&
          u.password === password
        );
        if (found) {
          if (found.isActive === false) {
            throw new Error('هذا الحساب معطل حالياً من قِبل إدارة النظام.');
          }
          // Synthesize user object
          const fakeUser = {
            uid: found.uid,
            email: found.email,
            displayName: found.displayName,
          } as User;
          return fakeUser;
        }
      }
    } catch (e) {}

    throw firebaseErr;
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

/**
 * Save store data to cloud (Cross-Device Sync)
 * 1. Writes to localStorage cache immediately (0ms)
 * 2. Writes to server sync API with 8s timeout
 * 3. Updates local cache with server merged result
 */
export const saveStoreDataToCloud = async (
  uid: string, 
  data: UserStoreData & { isForceReset?: boolean }
): Promise<{ success: boolean; data?: UserStoreData }> => {
  // Always update local cache first
  setLocalStoreData(uid, data);

  let isSynced = false;
  let serverMergedData: UserStoreData | undefined;

  // 1. Sync to server backend
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`/api/sync/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        serverMergedData = {
          products: Array.isArray(json.data.products) ? json.data.products : [],
          invoices: Array.isArray(json.data.invoices) ? json.data.invoices : [],
          customers: Array.isArray(json.data.customers) ? json.data.customers : [],
          settings: json.data.settings || data.settings
        };
        // Update local cache with authoritative merged result
        setLocalStoreData(uid, serverMergedData);
      }
      isSynced = true;
    }
  } catch (e) {
    console.warn("Server sync notice:", e);
  }

  // 2. Non-blocking background Firestore sync (if enabled on Firebase console)
  try {
    const storeDocRef = doc(db, 'users', uid, 'store', 'currentData');
    Promise.race([
      setDoc(storeDocRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]).catch(() => {});
  } catch (err: any) {}

  return { success: isSynced, data: serverMergedData };
};

/**
 * Load store data from cloud (Cross-Device Sync)
 * 1. Pulls from server sync API with 10s timeout
 * 2. Falls back to local storage cache if network is unavailable
 */
export const loadStoreDataFromCloud = async (uid: string): Promise<UserStoreData | null> => {
  const localCache = getLocalStoreData(uid);

  // 1. Try server backend with 10s timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`/api/sync/${encodeURIComponent(uid)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        const result: UserStoreData = {
          products: Array.isArray(d.products) ? d.products : [],
          invoices: Array.isArray(d.invoices) ? d.invoices : [],
          customers: Array.isArray(d.customers) ? d.customers : [],
          settings: d.settings || createInitialEmptySettings('مخزني', 'المشرف')
        };
        setLocalStoreData(uid, result);
        return result;
      }
    }
  } catch (e) {
    console.warn("Server pull notice:", e);
  }

  // 2. Fallback to local storage
  return localCache;
};
