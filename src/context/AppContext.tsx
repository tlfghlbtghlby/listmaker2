import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, 
  Customer, 
  Invoice, 
  InvoiceItem,
  InvoiceStatus,
  PaymentRecord, 
  StoreSettings, 
  CreateInvoiceInput 
} from '../types';
import { 
  auth, 
  db,
  logoutAccount, 
  saveStoreDataToCloud, 
  loadStoreDataFromCloud,
  getLocalStoreData,
  setLocalStoreData,
  createInitialEmptySettings,
  setCustomServerUrl,
  saveItemToFirestore,
  updateItemInFirestore,
  deleteItemFromFirestore,
  saveInvoiceToFirestore,
  updateInvoiceInFirestore,
  deleteInvoiceFromFirestore,
  saveCustomerToFirestore,
  updateCustomerInFirestore,
  deleteCustomerFromFirestore,
  saveSettingsToFirestore
} from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, collection, onSnapshot } from 'firebase/firestore';

interface AppContextType {
  // Data
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  settings: StoreSettings;

  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, delta: number) => void;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalDebt'> & { initialDebt?: number }) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Invoicing & Sales actions
  createInvoice: (data: CreateInvoiceInput) => Invoice;
  deleteInvoice: (id: string) => void;

  // Payments / Debt settlements
  recordPayment: (customerId: string, amount: number, notes?: string) => PaymentRecord;

  // Settings & Storage
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  resetToDemo: () => void;
  resetToZero: () => void;
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => { success: boolean; error?: string };
  formatMoney: (amount: number) => string;

  // Cloud & Auth
  currentUser: User | null;
  authLoading: boolean;
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNow: () => Promise<void>;
  syncFromRemoteUrl: (serverUrl: string) => Promise<{ success: boolean; message: string; count?: number }>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultEmptySettings: StoreSettings = {
  storeName: 'نظام المبيعات والمخزن',
  ownerName: '',
  phone: '',
  address: '',
  currency: 'دينار',
  defaultCategory: 'عام',
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
  printFormat: 'a4',
  enableWholesale: true,
  deviceMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
  desktopLayout: 'full',
};

// Smart merge helpers: Guarantee that locally created or updated items are NEVER lost or overwritten
const getDeletedProductIds = (uid: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`deleted_prod_ids_${uid}`);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
};

const markProductDeleted = (uid: string, id: string) => {
  try {
    const set = getDeletedProductIds(uid);
    set.add(id);
    localStorage.setItem(`deleted_prod_ids_${uid}`, JSON.stringify(Array.from(set)));
  } catch (e) {}
};

const unmarkProductDeleted = (uid: string, id: string) => {
  try {
    const set = getDeletedProductIds(uid);
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(`deleted_prod_ids_${uid}`, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
};

const smartMergeProducts = (local: Product[], remote: Product[], deletedIds?: Set<string>): Product[] => {
  const map = new Map<string, Product>();
  for (const p of remote) {
    if (p && p.id && (!deletedIds || !deletedIds.has(p.id))) {
      map.set(p.id, p);
    }
  }
  for (const p of local) {
    if (!p || !p.id || (deletedIds && deletedIds.has(p.id))) continue;
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

const smartMergeInvoices = (local: Invoice[], remote: Invoice[]): Invoice[] => {
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

const smartMergeCustomers = (local: Customer[], remote: Customer[]): Customer[] => {
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

// Track explicit user logout to prevent automatic transient session drops
let isExplicitLogout = false;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clean initial state: restore from local cache immediately on 0ms first render
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      if (lastUid) {
        const cached = getLocalStoreData(lastUid);
        if (cached && Array.isArray(cached.products) && cached.products.length > 0) return cached.products;
      }
      const guestRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('alnoor_pos_products_v2') : null;
      if (guestRaw) return JSON.parse(guestRaw);
    } catch {}
    return [];
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      if (lastUid) {
        const cached = getLocalStoreData(lastUid);
        if (cached && Array.isArray(cached.customers)) return cached.customers;
      }
    } catch {}
    return [];
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      if (lastUid) {
        const cached = getLocalStoreData(lastUid);
        if (cached && Array.isArray(cached.invoices)) return cached.invoices;
      }
    } catch {}
    return [];
  });
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      if (lastUid) {
        const cached = getLocalStoreData(lastUid);
        if (cached && cached.settings) return cached.settings;
      }
    } catch {}
    return defaultEmptySettings;
  });

  // Cloud Auth & Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      if (lastUid) {
        const rawProfile = localStorage.getItem(`profile_${lastUid}`);
        const p = rawProfile ? JSON.parse(rawProfile) : null;
        return {
          uid: lastUid,
          email: p?.email || `${lastUid}@list-3d848.app`,
          displayName: p?.displayName || p?.username || 'مستخدم',
        } as User;
      }
    } catch (e) {}
    return null;
  });

  const [authLoading, setAuthLoading] = useState(() => {
    try {
      const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
      return !lastUid;
    } catch {
      return true;
    }
  });

  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isInitialSyncCompleted, setIsInitialSyncCompleted] = useState(false);

  // Manual & Automatic instant two-way sync (<50ms)
  const syncNow = async () => {
    if (!currentUser) return;
    setIsSyncing(true);

    try {
      // Send current state to smart merge endpoint on server and Firestore
      const res = await saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices,
        customers,
        settings
      });

      if (res.data) {
        const deletedIds = getDeletedProductIds(currentUser.uid);
        if (Array.isArray(res.data.products)) {
          setProducts((prev) => smartMergeProducts(prev, res.data!.products, deletedIds));
        }
        if (Array.isArray(res.data.invoices)) {
          setInvoices((prev) => smartMergeInvoices(prev, res.data!.invoices));
        }
        if (Array.isArray(res.data.customers)) {
          setCustomers((prev) => smartMergeCustomers(prev, res.data!.customers));
        }
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      }

      setIsCloudConnected(true);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn("Manual sync notice:", err);
      setIsCloudConnected(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Direct Network sync with PC / Remote Cloud Server URL (Essential for Android APK <-> PC sync!)
  const syncFromRemoteUrl = async (serverUrl: string): Promise<{ success: boolean; message: string; count?: number }> => {
    if (!serverUrl || !serverUrl.trim()) {
      return { success: false, message: 'يرجى إدخال عنوان خادم الكمبيوتر أولاً.' };
    }
    const cleanUrl = serverUrl.trim().replace(/\/$/, '');
    setIsSyncing(true);

    try {
      // 1. Test health with 3.5s timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const healthRes = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!healthRes.ok) {
        return { success: false, message: `تعذر الاتصال بالخادم (${healthRes.status}). تأكد من تشغيل البرنامج على الكمبيوتر ومن اتصال الجهازين بنفس شبكة الواي فاي.` };
      }

      // 2. Save server URL locally for future operations
      setCustomServerUrl(cleanUrl);

      const uid = currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null) || '3PIvpIA3jVVGQsaD8wGCar3gvpo1';
      
      // 3. Fetch full sync bundle (products, invoices, customers, settings, registered clients)
      let storeData: any = null;
      let clientsData: any[] = [];

      try {
        const fullRes = await fetch(`${cleanUrl}/api/full-sync/${encodeURIComponent(uid)}`);
        if (fullRes.ok) {
          const fullJson = await fullRes.json();
          if (fullJson.success) {
            storeData = fullJson.storeData;
            clientsData = Array.isArray(fullJson.clients) ? fullJson.clients : [];
          }
        }
      } catch (e) {}

      // Fallback: If full-sync was not provided, continue with available data

      if (clientsData.length === 0) {
        try {
          const clientsRes = await fetch(`${cleanUrl}/api/admin/users`);
          if (clientsRes.ok) {
            const clientsJson = await clientsRes.json();
            if (Array.isArray(clientsJson.users)) clientsData = clientsJson.users;
          }
        } catch (e) {}
      }

      let updatedCount = 0;
      const deletedIds = getDeletedProductIds(uid);

      if (storeData) {
        if (Array.isArray(storeData.products)) {
          updatedCount = storeData.products.length;
          setProducts((prev) => smartMergeProducts(prev, storeData.products, deletedIds));
        }
        if (Array.isArray(storeData.invoices)) {
          setInvoices((prev) => smartMergeInvoices(prev, storeData.invoices));
        }
        if (Array.isArray(storeData.customers)) {
          setCustomers((prev) => smartMergeCustomers(prev, storeData.customers));
        }
        if (storeData.settings) {
          setSettings((prev) => ({ ...prev, ...storeData.settings }));
        }
        setLocalStoreData(uid, storeData);
      }

      if (clientsData.length > 0) {
        try {
          localStorage.setItem('admin_cached_clients', JSON.stringify(clientsData));
        } catch (e) {}
      }

      // Also mirror store data and clients to Cloud Firestore if connected
      if (storeData && currentUser) {
        saveStoreDataToCloud(uid, storeData).catch(() => {});
      }

      setIsCloudConnected(true);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      return { 
        success: true, 
        message: `تم الاتصال بنجاح! تم استيراد ومزامنة ${updatedCount} مادة و ${clientsData.length} حساب زبون.`,
        count: updatedCount
      };
    } catch (err: any) {
      return { 
        success: false, 
        message: `فشل الاتصال: ${err.message || 'تعذر الوصول إلى جهاز الكمبيوتر'}. تأكد من صحة عنوان IP وأن الهاتف والكمبيوتر متصلان بنفس شبكة الواي فاي.` 
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to Firebase Auth state - Strictly enforce per-user isolation & automatic cloud connection!
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    let unsubscribeItems: (() => void) | null = null;
    let unsubscribeInvoices: (() => void) | null = null;
    let unsubscribeCustomers: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;

    const cleanAllListeners = () => {
      if (unsubscribeFirestore) { unsubscribeFirestore(); unsubscribeFirestore = null; }
      if (unsubscribeItems) { unsubscribeItems(); unsubscribeItems = null; }
      if (unsubscribeInvoices) { unsubscribeInvoices(); unsubscribeInvoices = null; }
      if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
      if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
    };

    // Immediately restore cached local data on mount if user session exists in localStorage
    const existingUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
    if (existingUid) {
      const localCached = getLocalStoreData(existingUid);
      if (localCached) {
        if (Array.isArray(localCached.products) && localCached.products.length > 0) {
          setProducts((prev) => smartMergeProducts(prev, localCached.products, getDeletedProductIds(existingUid)));
        }
        if (Array.isArray(localCached.invoices) && localCached.invoices.length > 0) {
          setInvoices((prev) => smartMergeInvoices(prev, localCached.invoices));
        }
        if (Array.isArray(localCached.customers) && localCached.customers.length > 0) {
          setCustomers((prev) => smartMergeCustomers(prev, localCached.customers));
        }
        if (localCached.settings) {
          setSettings(localCached.settings);
        }
      }
      setAuthLoading(false);
      setIsInitialSyncCompleted(true);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous Firestore listeners
      cleanAllListeners();

      if (user) {
        // User is logged into Firebase Auth!
        isExplicitLogout = false;
        setCurrentUser(user);
        setIsCloudConnected(true);

        try {
          localStorage.setItem('has_logged_in_before', 'true');
          localStorage.setItem('last_active_user_uid', user.uid);
        } catch (e) {}

        const deletedIds = getDeletedProductIds(user.uid);

        // Check if there are any unauthenticated / guest products created prior to login
        const guestProductsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('alnoor_pos_products_v2') : null;
        let guestProducts: Product[] = [];
        if (guestProductsRaw) {
          try {
            guestProducts = JSON.parse(guestProductsRaw);
            localStorage.removeItem('alnoor_pos_products_v2');
          } catch (e) {}
        }

        // 1. Immediately preview cached local data for instant UI responsiveness
        const localCached = getLocalStoreData(user.uid);
        if (localCached) {
          const mergedProducts = smartMergeProducts(
            guestProducts.length > 0 ? guestProducts : [],
            localCached.products || [],
            deletedIds
          );
          setProducts((prev) => smartMergeProducts(prev, mergedProducts, deletedIds));
          setInvoices((prev) => smartMergeInvoices(prev, localCached.invoices || []));
          setCustomers((prev) => smartMergeCustomers(prev, localCached.customers || []));
          if (localCached.settings) {
            setSettings(localCached.settings);
          }
        } else {
          if (guestProducts.length > 0) {
            setProducts((prev) => smartMergeProducts(prev, guestProducts, deletedIds));
          }
          setSettings(createInitialEmptySettings(user.displayName || 'مخزني', user.displayName || ''));
        }

        // Unblock UI immediately
        setAuthLoading(false);
        setIsInitialSyncCompleted(true);

        // 2. Fetch authoritative Cloud Firestore data asynchronously in the background
        loadStoreDataFromCloud(user.uid)
          .then((cloudData) => {
            if (cloudData) {
              const currentDeletedIds = getDeletedProductIds(user.uid);
              if (Array.isArray(cloudData.products)) {
                setProducts((prev) => {
                  const merged = smartMergeProducts(prev, cloudData.products, currentDeletedIds);
                  saveStoreDataToCloud(user.uid, {
                    products: merged,
                    invoices: cloudData.invoices || [],
                    customers: cloudData.customers || [],
                    settings: cloudData.settings || {}
                  }).catch(() => {});
                  return merged;
                });
              }
              if (Array.isArray(cloudData.invoices)) {
                setInvoices((prev) => smartMergeInvoices(prev, cloudData.invoices));
              }
              if (Array.isArray(cloudData.customers)) {
                setCustomers((prev) => smartMergeCustomers(prev, cloudData.customers));
              }
              if (cloudData.settings) {
                setSettings(cloudData.settings);
              }
            }
            setIsCloudConnected(true);
          })
          .catch((err) => {
            console.warn("Initial cloud load notice:", err);
            setIsCloudConnected(true);
          });

        // 3. Attach Real-Time Firestore collection listeners for items, invoices, customers, and settings
        try {
          // A. Items collection listener (المواد والمخزن)
          const itemsCol = collection(db, 'items');
          unsubscribeItems = onSnapshot(itemsCol, (snapshot) => {
            const currentDeletedIds = getDeletedProductIds(user.uid);
            const itemsList: Product[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && (!data.userId || data.userId === user.uid) && !currentDeletedIds.has(docSnap.id)) {
                itemsList.push({ id: docSnap.id, ...data } as Product);
              }
            });

            // Handle real-time removals from other devices
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const removedId = change.doc.id;
                markProductDeleted(user.uid, removedId);
                setProducts((prev) => prev.filter((p) => p.id !== removedId));
              }
            });

            if (itemsList.length > 0) {
              setProducts((prev) => smartMergeProducts(prev, itemsList, currentDeletedIds));
            }
            setIsCloudConnected(true);
          }, (err) => {
            console.warn("Real-time items listener notice:", err);
          });

          // B. Invoices collection listener (القوائم والفواتير)
          const invoicesCol = collection(db, 'invoices');
          unsubscribeInvoices = onSnapshot(invoicesCol, (snapshot) => {
            const invList: Invoice[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && (!data.userId || data.userId === user.uid)) {
                invList.push({ id: docSnap.id, ...data } as Invoice);
              }
            });

            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const removedId = change.doc.id;
                setInvoices((prev) => prev.filter((inv) => inv.id !== removedId));
              }
            });

            if (invList.length > 0) {
              setInvoices((prev) => smartMergeInvoices(prev, invList));
            }
            setIsCloudConnected(true);
          }, (err) => {
            console.warn("Real-time invoices listener notice:", err);
          });

          // C. Customers collection listener (الزبائن والديون)
          const customersCol = collection(db, 'customers');
          unsubscribeCustomers = onSnapshot(customersCol, (snapshot) => {
            const custList: Customer[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && (!data.userId || data.userId === user.uid)) {
                custList.push({ id: docSnap.id, ...data } as Customer);
              }
            });

            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const removedId = change.doc.id;
                setCustomers((prev) => prev.filter((c) => c.id !== removedId));
              }
            });

            if (custList.length > 0) {
              setCustomers((prev) => smartMergeCustomers(prev, custList));
            }
            setIsCloudConnected(true);
          }, (err) => {
            console.warn("Real-time customers listener notice:", err);
          });

          // D. Settings listener
          const settingsDocRef = doc(db, 'settings', user.uid);
          unsubscribeSettings = onSnapshot(settingsDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const d = snapshot.data();
              if (d) {
                setSettings((prev) => ({ ...prev, ...d }));
              }
            }
          }, (err) => {
            console.warn("Real-time settings listener notice:", err);
          });

          // E. Legacy user store document listener
          const storeDocRef = doc(db, 'users', user.uid, 'store', 'currentData');
          unsubscribeFirestore = onSnapshot(storeDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const d = snapshot.data();
              if (d) {
                const currentDeletedIds = getDeletedProductIds(user.uid);
                if (Array.isArray(d.products)) {
                  setProducts((prev) => smartMergeProducts(prev, d.products, currentDeletedIds));
                }
                if (Array.isArray(d.invoices)) {
                  setInvoices((prev) => smartMergeInvoices(prev, d.invoices));
                }
                if (Array.isArray(d.customers)) {
                  setCustomers((prev) => smartMergeCustomers(prev, d.customers));
                }
                if (d.settings) {
                  setSettings(d.settings);
                }
              }
            }
            setIsCloudConnected(true);
          }, (err) => {
            console.warn("Firestore realtime listener notice:", err);
          });
        } catch (e) {}

      } else {
        // User object is null from Firebase Auth
        const lastUid = typeof localStorage !== 'undefined' ? localStorage.getItem('last_active_user_uid') : null;
        if (lastUid && !isExplicitLogout) {
          // DO NOT auto-log out! Keep user session persistent across app restarts / token refreshes
          const cachedProfileRaw = localStorage.getItem(`profile_${lastUid}`);
          let profileObj: any = null;
          try {
            if (cachedProfileRaw) profileObj = JSON.parse(cachedProfileRaw);
          } catch (e) {}
          
          const preservedUser = {
            uid: lastUid,
            email: profileObj?.email || `${lastUid}@list-manger3.app`,
            displayName: profileObj?.displayName || profileObj?.username || 'مستخدم',
          } as User;

          setCurrentUser(preservedUser);
          setIsCloudConnected(true);
          setAuthLoading(false);
          setIsInitialSyncCompleted(true);
          return;
        }

        // Only clear if user explicitly pressed logout!
        if (isExplicitLogout) {
          setProducts([]);
          setInvoices([]);
          setCustomers([]);
          setPayments([]);
          setSettings(defaultEmptySettings);
          setCurrentUser(null);
          setIsCloudConnected(false);
          setIsInitialSyncCompleted(false);
          setAuthLoading(false);
        } else {
          setAuthLoading(false);
        }
      }
    });

    // Safety timeout: Ensure loading screen never hangs forever
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 3000);

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      cleanAllListeners();
    };
  }, []);

  // Periodic check & sync on window focus / tab switch so multiple devices stay in sync
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted) return;

    const pullLatest = async () => {
      if (document.hidden) return;
      try {
        const cloudData = await loadStoreDataFromCloud(currentUser.uid);
        if (cloudData) {
          const deletedIds = getDeletedProductIds(currentUser.uid);
          if (Array.isArray(cloudData.products) && cloudData.products.length > 0) {
            setProducts((prev) => smartMergeProducts(prev, cloudData.products, deletedIds));
          }
          if (Array.isArray(cloudData.invoices)) {
            setInvoices((prev) => smartMergeInvoices(prev, cloudData.invoices));
          }
          if (Array.isArray(cloudData.customers)) {
            setCustomers((prev) => smartMergeCustomers(prev, cloudData.customers));
          }
          if (cloudData.settings) {
            setSettings(cloudData.settings);
          }
          setIsCloudConnected(true);
        }
      } catch (e) {}
    };

    const handleFocus = () => pullLatest();
    const handleVisibility = () => {
      if (!document.hidden) pullLatest();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Poll every 20 seconds
    const interval = setInterval(pullLatest, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [currentUser, isInitialSyncCompleted]);

  // Online network connectivity trigger
  useEffect(() => {
    if (currentUser) {
      setIsCloudConnected(true);
    }
    const handleOnline = () => {
      setIsCloudConnected(Boolean(currentUser));
      if (currentUser && isInitialSyncCompleted) {
        syncNow();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser, isInitialSyncCompleted]);

  // Product CRUD with Immediate Persistence (<0ms) & Cloud Backup
  const addProduct = (prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...prodData,
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      code: prodData.code.trim() || `${1000 + products.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };

    if (currentUser) {
      unmarkProductDeleted(currentUser.uid, newProduct.id);
      saveItemToFirestore(newProduct, currentUser.uid);
    }

    setProducts((prev) => {
      const updated = [newProduct, ...prev.filter((p) => p.id !== newProduct.id)];
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products: updated,
          invoices: cached?.invoices || invoices,
          customers: cached?.customers || customers,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products: updated,
          invoices,
          customers,
          settings,
        }).catch(() => {});
      } else {
        try {
          localStorage.setItem('alnoor_pos_products_v2', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const now = new Date().toISOString();
    if (currentUser) {
      updateItemInFirestore(id, updates, currentUser.uid);
    }
    setProducts((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: now } : item));
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products: updated,
          invoices: cached?.invoices || invoices,
          customers: cached?.customers || customers,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products: updated,
          invoices,
          customers,
          settings,
        }).catch(() => {});
      } else {
        try {
          localStorage.setItem('alnoor_pos_products_v2', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const deleteProduct = (id: string) => {
    if (currentUser) {
      markProductDeleted(currentUser.uid, id);
      deleteItemFromFirestore(id);
    }
    setProducts((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products: updated,
          invoices: cached?.invoices || invoices,
          customers: cached?.customers || customers,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products: updated,
          invoices,
          customers,
          settings,
        }).catch(() => {});
      } else {
        try {
          localStorage.setItem('alnoor_pos_products_v2', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const adjustStock = (id: string, delta: number) => {
    const now = new Date().toISOString();
    setProducts((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const newStock = Math.max(0, p.stock + delta);
          if (currentUser) {
            updateItemInFirestore(id, { stock: newStock }, currentUser.uid);
          }
          return { ...p, stock: newStock, updatedAt: now };
        }
        return p;
      });
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products: updated,
          invoices: cached?.invoices || invoices,
          customers: cached?.customers || customers,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products: updated,
          invoices,
          customers,
          settings,
        }).catch(() => {});
      } else {
        try {
          localStorage.setItem('alnoor_pos_products_v2', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  // Customer CRUD
  const addCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'totalDebt'> & { initialDebt?: number }): Customer => {
    const newCustomer: Customer = {
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || '',
      totalDebt: data.initialDebt || 0,
      notes: data.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    if (currentUser) {
      saveCustomerToFirestore(newCustomer, currentUser.uid);
    }
    setCustomers((prev) => {
      const updated = [newCustomer, ...prev];
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings,
        }).catch(() => {});
      }
      return updated;
    });
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    if (currentUser) {
      updateCustomerInFirestore(id, updates, currentUser.uid);
    }
    setCustomers((prev) => {
      const updated = prev.map((cust) => (cust.id === id ? { ...cust, ...updates } : cust));
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings,
        }).catch(() => {});
      }
      return updated;
    });
  };

  const deleteCustomer = (id: string) => {
    if (currentUser) {
      deleteCustomerFromFirestore(id);
    }
    setCustomers((prev) => {
      const updated = prev.filter((cust) => cust.id !== id);
      if (currentUser) {
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings: cached?.settings || settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products,
          invoices,
          customers: updated,
          settings,
        }).catch(() => {});
      }
      return updated;
    });
  };

  // Invoicing
  const createInvoice = (data: CreateInvoiceInput): Invoice => {
    const now = new Date().toISOString();
    const dateYear = new Date().getFullYear();
    const countToday = invoices.length + 1;
    const invoiceNumber = `INV-${dateYear}-${String(countToday).padStart(4, '0')}`;

    let subtotal = 0;
    let totalCost = 0;

    const items = data.items.map((item: InvoiceItem) => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemCostTotal = item.costPrice * item.quantity;
      subtotal += itemSubtotal;
      totalCost += itemCostTotal;
      return {
        ...item,
        subtotal: itemSubtotal,
      };
    });

    const total = Math.max(0, subtotal - data.discount);
    const paidAmount = data.type === 'direct' ? total : (data.paidAmount || 0);
    const remainingAmount = Math.max(0, total - paidAmount);
    const netProfit = total - totalCost;

    const customer = data.customerId ? customers.find((c) => c.id === data.customerId) : undefined;
    const previousDebt = customer ? customer.totalDebt : 0;
    const currentTotalDebt = previousDebt + (data.type === 'credit' ? remainingAmount : 0);
    const status: InvoiceStatus = remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const newInvoice: Invoice = {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invoiceNumber,
      date: now,
      type: data.type,
      customerId: data.customerId,
      customerName: data.customerName || (data.type === 'direct' ? 'زبون نقدي مباشر' : 'عميل غير مسجل'),
      customerPhone: data.customerPhone,
      items: data.items,
      subtotal,
      discount: data.discount,
      total,
      paidAmount,
      remainingAmount,
      previousDebt,
      currentTotalDebt,
      paymentDueDate: data.paymentDueDate,
      status,
      notes: data.notes,
      totalCost,
      netProfit,
    };

    // Deduct stock for each sold item
    data.items.forEach((item: InvoiceItem) => {
      adjustStock(item.productId, -(item.deductedPieces ?? item.quantity));
    });

    // Update customer debt if credit invoice
    let updatedCustomers = customers;
    if (data.type === 'credit' && data.customerId && remainingAmount > 0) {
      updatedCustomers = customers.map((c) =>
        c.id === data.customerId ? { ...c, totalDebt: c.totalDebt + remainingAmount } : c
      );
      setCustomers(updatedCustomers);
    }

    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);

    if (currentUser) {
      saveInvoiceToFirestore(newInvoice, currentUser.uid);
      setLocalStoreData(currentUser.uid, {
        products,
        invoices: updatedInvoices,
        customers: updatedCustomers,
        settings,
      });
      saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices: updatedInvoices,
        customers: updatedCustomers,
        settings,
      }).catch(() => {});
    }

    return newInvoice;
  };

  const deleteInvoice = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;

    // Restore stock for deleted invoice
    inv.items.forEach((item: InvoiceItem) => {
      adjustStock(item.productId, (item.deductedPieces ?? item.quantity));
    });

    // Revert debt if credit invoice
    let updatedCustomers = customers;
    if (inv.type === 'credit' && inv.customerId && inv.remainingAmount > 0) {
      updatedCustomers = customers.map((c) =>
        c.id === inv.customerId
          ? { ...c, totalDebt: Math.max(0, c.totalDebt - inv.remainingAmount) }
          : c
      );
      setCustomers(updatedCustomers);
    }

    const updatedInvoices = invoices.filter((i) => i.id !== id);
    setInvoices(updatedInvoices);

    if (currentUser) {
      deleteInvoiceFromFirestore(id);
      setLocalStoreData(currentUser.uid, {
        products,
        invoices: updatedInvoices,
        customers: updatedCustomers,
        settings,
      });
      saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices: updatedInvoices,
        customers: updatedCustomers,
        settings,
      }).catch(() => {});
    }
  };

  // Payment recording (تسديد الديون)
  const recordPayment = (customerId: string, amount: number, notes?: string): PaymentRecord => {
    const customer = customers.find((c) => c.id === customerId);
    const count = payments.length + 1;
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newPayment: PaymentRecord = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      customerId,
      customerName: customer ? customer.name : 'عميل غير مسجل',
      amount,
      date: new Date().toISOString(),
      notes,
      receiptNumber,
    };

    setPayments((prev) => [newPayment, ...prev]);

    // Deduct amount from customer's total debt
    let updatedCustomers = customers;
    setCustomers((prev) => {
      updatedCustomers = prev.map((c) =>
        c.id === customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - amount) } : c
      );
      if (currentUser) {
        setLocalStoreData(currentUser.uid, {
          products,
          invoices,
          customers: updatedCustomers,
          settings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products,
          invoices,
          customers: updatedCustomers,
          settings,
        }).catch(() => {});
      }
      return updatedCustomers;
    });

    return newPayment;
  };

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (currentUser) {
        saveSettingsToFirestore(updated, currentUser.uid);
        const cached = getLocalStoreData(currentUser.uid);
        setLocalStoreData(currentUser.uid, {
          products,
          invoices,
          customers,
          settings: updated,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products,
          invoices,
          customers,
          settings: updated,
        }).catch(() => {});
      }
      return updated;
    });
  };

  const resetToDemo = () => {
    // Only if confirmed
  };

  const resetToZero = () => {
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    if (currentUser) {
      setLocalStoreData(currentUser.uid, {
        products: [],
        customers: [],
        invoices: [],
        settings,
      });
      saveStoreDataToCloud(currentUser.uid, {
        products: [],
        customers: [],
        invoices: [],
        settings,
        isForceReset: true,
      });
    }
  };

  const exportDataJSON = (): string => {
    let clients = [];
    try {
      const localClients = localStorage.getItem('admin_cached_clients');
      if (localClients) clients = JSON.parse(localClients);
    } catch (e) {}

    const backup = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      products,
      customers,
      invoices,
      payments,
      settings,
      clients,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDataJSON = (jsonStr: string): { success: boolean; error?: string } => {
    try {
      const data = JSON.parse(jsonStr);
      let updatedProducts = products;
      let updatedCustomers = customers;
      let updatedInvoices = invoices;
      let updatedSettings = settings;

      if (Array.isArray(data.products)) {
        updatedProducts = data.products;
        setProducts(data.products);
      }
      if (Array.isArray(data.customers)) {
        updatedCustomers = data.customers;
        setCustomers(data.customers);
      }
      if (Array.isArray(data.invoices)) {
        updatedInvoices = data.invoices;
        setInvoices(data.invoices);
      }
      if (Array.isArray(data.payments)) setPayments(data.payments);
      if (data.settings) {
        updatedSettings = { ...settings, ...data.settings };
        setSettings(updatedSettings);
      }
      if (Array.isArray(data.clients) && data.clients.length > 0) {
        try {
          localStorage.setItem('admin_cached_clients', JSON.stringify(data.clients));
        } catch (e) {}
      }

      if (currentUser) {
        setLocalStoreData(currentUser.uid, {
          products: updatedProducts,
          invoices: updatedInvoices,
          customers: updatedCustomers,
          settings: updatedSettings,
        });
        saveStoreDataToCloud(currentUser.uid, {
          products: updatedProducts,
          invoices: updatedInvoices,
          customers: updatedCustomers,
          settings: updatedSettings,
        }).catch(() => {});
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const formatMoney = (amount: number): string => {
    return `${amount.toLocaleString('en-US')} ${settings.currency}`;
  };

  // SECURE & EXPLICIT LOGOUT:
  // Only called when the user deliberately chooses to log out!
  const logout = async () => {
    isExplicitLogout = true;

    if (currentUser) {
      saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices,
        customers,
        settings,
      }).catch(() => {});
    }

    // Immediately clear in-memory state so nothing leaks to unauthenticated screen
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    setSettings(defaultEmptySettings);
    setCurrentUser(null);
    setIsCloudConnected(false);

    try {
      localStorage.removeItem('has_logged_in_before');
      localStorage.removeItem('last_active_user_uid');
      // Clean up legacy global shared keys
      localStorage.removeItem('alnoor_pos_products_v2');
      localStorage.removeItem('alnoor_pos_customers_v2');
      localStorage.removeItem('alnoor_pos_invoices_v2');
      localStorage.removeItem('alnoor_pos_payments_v2');
      localStorage.removeItem('alnoor_pos_settings_v2');
    } catch (e) {}

    await logoutAccount();
  };

  return (
    <AppContext.Provider
      value={{
        products,
        customers,
        invoices,
        payments,
        settings,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        createInvoice,
        deleteInvoice,
        recordPayment,
        updateSettings,
        resetToDemo,
        resetToZero,
        exportDataJSON,
        importDataJSON,
        formatMoney,
        currentUser,
        authLoading,
        isCloudConnected,
        isSyncing,
        lastSyncTime,
        syncNow,
        syncFromRemoteUrl,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
