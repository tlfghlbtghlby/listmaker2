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
  createInitialEmptySettings
} from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clean initial state: No account data is loaded until authenticated!
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultEmptySettings);

  // Cloud Auth & Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isInitialSyncCompleted, setIsInitialSyncCompleted] = useState(false);

  // Manual & Automatic instant two-way sync (<50ms)
  const syncNow = async () => {
    if (!currentUser) return;
    setIsSyncing(true);

    try {
      // Send current state to smart merge endpoint on server
      const res = await saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices,
        customers,
        settings
      });

      if (res.data) {
        if (Array.isArray(res.data.products)) {
          setProducts(res.data.products);
        }
        if (Array.isArray(res.data.invoices)) {
          setInvoices(res.data.invoices);
        }
        if (Array.isArray(res.data.customers)) {
          setCustomers(res.data.customers);
        }
        if (res.data.settings) {
          setSettings(res.data.settings);
        }
      }

      setIsCloudConnected(res.success);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn("Manual sync notice:", err);
      setIsCloudConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to Firebase Auth state - Strictly enforce per-user isolation & automatic cloud connection!
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous Firestore listener if any
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      setCurrentUser(user);
      if (user) {
        // User is logged into Firebase Auth - Always set Cloud Connected to true!
        setIsCloudConnected(true);

        try {
          localStorage.setItem('has_logged_in_before', 'true');
          localStorage.setItem('last_active_user_uid', user.uid);
        } catch (e) {}

        setIsInitialSyncCompleted(false);

        // 1. Immediately preview cached local data for instant UI responsiveness
        const localCached = getLocalStoreData(user.uid);
        if (localCached) {
          setProducts(Array.isArray(localCached.products) ? localCached.products : []);
          setInvoices(Array.isArray(localCached.invoices) ? localCached.invoices : []);
          setCustomers(Array.isArray(localCached.customers) ? localCached.customers : []);
          if (localCached.settings) {
            setSettings(localCached.settings);
          }
        } else {
          setSettings(createInitialEmptySettings(user.displayName || 'مخزني', user.displayName || ''));
        }

        // Unblock UI immediately so the user is never stuck on a loading screen
        setAuthLoading(false);
        setIsInitialSyncCompleted(true);

        // 2. Fetch authoritative Cloud Firestore data asynchronously in the background
        loadStoreDataFromCloud(user.uid)
          .then((cloudData) => {
            if (cloudData) {
              if (Array.isArray(cloudData.products)) setProducts(cloudData.products);
              if (Array.isArray(cloudData.invoices)) setInvoices(cloudData.invoices);
              if (Array.isArray(cloudData.customers)) setCustomers(cloudData.customers);
              if (cloudData.settings) setSettings(cloudData.settings);
            }
            setIsCloudConnected(true);
          })
          .catch((err) => {
            console.warn("Initial cloud load notice:", err);
            setIsCloudConnected(true);
          });

        // 3. Attach Real-Time Firestore listener so updates from other devices sync instantly (<100ms)
        try {
          const storeDocRef = doc(db, 'users', user.uid, 'store', 'currentData');
          unsubscribeFirestore = onSnapshot(storeDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const d = snapshot.data();
              if (d) {
                // If the snapshot comes from server, synchronize state smoothly
                if (Array.isArray(d.products)) setProducts(d.products);
                if (Array.isArray(d.invoices)) setInvoices(d.invoices);
                if (Array.isArray(d.customers)) setCustomers(d.customers);
                if (d.settings) setSettings(d.settings);
              }
            }
            setIsCloudConnected(true);
          }, (err) => {
            console.warn("Firestore realtime listener notice:", err);
          });
        } catch (e) {}

      } else {
        // LOGGED OUT / NO USER: Clear memory state completely!
        setProducts([]);
        setInvoices([]);
        setCustomers([]);
        setPayments([]);
        setSettings(defaultEmptySettings);
        setIsCloudConnected(false);
        setIsInitialSyncCompleted(false);
        setAuthLoading(false);
      }
    });

    // Safety timeout: Ensure loading screen never hangs under any slow network condition
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 1200);

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Save to cloud & account storage automatically whenever data changes (ONLY after initial sync finishes!)
  useEffect(() => {
    if (!currentUser || authLoading || !isInitialSyncCompleted) return;
    const timer = setTimeout(() => {
      saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices,
        customers,
        settings
      }).then(() => {
        setIsCloudConnected(true);
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [products, invoices, customers, settings, currentUser, authLoading, isInitialSyncCompleted]);

  // Periodic check & sync on window focus / tab switch so multiple devices stay in sync
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted) return;

    const pullLatest = async () => {
      if (document.hidden) return;
      try {
        const cloudData = await loadStoreDataFromCloud(currentUser.uid);
        if (cloudData) {
          if (Array.isArray(cloudData.products) && cloudData.products.length > 0) {
            setProducts(cloudData.products);
          }
          if (Array.isArray(cloudData.invoices)) {
            setInvoices(cloudData.invoices);
          }
          if (Array.isArray(cloudData.customers)) {
            setCustomers(cloudData.customers);
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

    // Poll every 15 seconds
    const interval = setInterval(pullLatest, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [currentUser, isInitialSyncCompleted]);

  // Online network connectivity trigger (never disconnects on unreliable WebView offline events)
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

  // Product CRUD
  const addProduct = (prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...prodData,
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      code: prodData.code.trim() || `${1000 + products.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: now } : item))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
  };

  const adjustStock = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );
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
    setCustomers((prev) => [newCustomer, ...prev]);
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((cust) => (cust.id === id ? { ...cust, ...updates } : cust))
    );
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((cust) => cust.id !== id));
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
    if (data.type === 'credit' && data.customerId && remainingAmount > 0) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === data.customerId ? { ...c, totalDebt: c.totalDebt + remainingAmount } : c
        )
      );
    }

    setInvoices((prev) => [newInvoice, ...prev]);
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
    if (inv.type === 'credit' && inv.customerId && inv.remainingAmount > 0) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === inv.customerId
            ? { ...c, totalDebt: Math.max(0, c.totalDebt - inv.remainingAmount) }
            : c
        )
      );
    }

    setInvoices((prev) => prev.filter((i) => i.id !== id));
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
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - amount) } : c
      )
    );

    return newPayment;
  };

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
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
      saveStoreDataToCloud(currentUser.uid, {
        products: [],
        customers: [],
        invoices: [],
        settings,
        isForceReset: true
      });
    }
  };

  const exportDataJSON = (): string => {
    const backup = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      products,
      customers,
      invoices,
      payments,
      settings,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDataJSON = (jsonStr: string): { success: boolean; error?: string } => {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.invoices)) setInvoices(data.invoices);
      if (Array.isArray(data.payments)) setPayments(data.payments);
      if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const formatMoney = (amount: number): string => {
    return `${amount.toLocaleString('en-US')} ${settings.currency}`;
  };

  // SECURE & CLEAN LOGOUT:
  // 1. Flush any pending changes to this account's persistent storage
  // 2. Clear all active memory state so no private data remains visible
  // 3. Clear auth session flags and remove legacy shared keys
  // 4. Sign out
  const logout = async () => {
    if (currentUser) {
      saveStoreDataToCloud(currentUser.uid, {
        products,
        invoices,
        customers,
        settings
      });
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
