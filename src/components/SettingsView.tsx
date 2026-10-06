import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { ADMIN_EMAIL } from '../types';
import { 
  changeCurrentUserPassword, 
  updateCurrentUserProfile,
  getFirestoreDiagnostic,
  getCustomServerUrl,
  setCustomServerUrl
} from '../firebase';
import { 
  Settings, 
  Store, 
  FileText, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  AlertTriangle,
  Cloud, 
  LogOut, 
  Trash2, 
  RefreshCw, 
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Wifi,
  Smartphone,
  Laptop,
  ExternalLink,
  Copy,
  CheckCheck
} from 'lucide-react';

// Dynamic lazy import to completely exclude AdminPanel code chunk for regular clients
const AdminPanel = React.lazy(() => import('./AdminPanel'));

const COMMON_CURRENCIES = [
  { code: 'د.ع', name: 'دينار عراقي (IQD)' },
  { code: '$', name: 'دولار أمريكي (USD)' },
  { code: 'ر.س', name: 'ريال سعودي (SAR)' },
  { code: 'ج.م', name: 'جنيه مصري (EGP)' },
  { code: 'د.إ', name: 'درهم إماراتي (AED)' },
  { code: 'د.ك', name: 'دينار كويتي (KWD)' },
  { code: 'د.أ', name: 'دينار أردني (JOD)' },
];

const COMMON_DEFAULT_CATEGORIES = [
  'عام',
  'مواد غذائية',
  'كهربائيات',
  'مواد إنشائية',
  'أدوات منزلية',
  'صحيات وسباكة',
  'منظفات',
  'قرطاسية',
  'قطع غيار',
  'ملابس وأقمشة',
  'موبايلات وإلكترونيات',
  'حلويات ومعجنات',
  'أعلاف ومستلزمات زراعية',
];

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    exportDataJSON, 
    importDataJSON, 
    resetToDemo,
    currentUser,
    logout,
    syncFromRemoteUrl,
    syncNow,
    isSyncing,
    lastSyncTime,
    isCloudConnected
  } = useApp();

  const [storeName, setStoreName] = useState(settings.storeName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultCategory, setDefaultCategory] = useState(settings.defaultCategory || 'عام');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(settings.invoiceFooterNote);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>(settings.printFormat);
  const [enableWholesale, setEnableWholesale] = useState<boolean>(settings.enableWholesale ?? true);
  const [desktopLayout, setDesktopLayout] = useState<'full' | 'partial'>(settings.desktopLayout || 'full');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Network and Firestore Sync State (Critical for Android <-> PC Sync!)
  const [firestoreStatus, setFirestoreStatus] = useState<{ status: 'ok' | 'disabled' | 'error'; message: string } | null>(null);
  const [isCheckingFirestore, setIsCheckingFirestore] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getCustomServerUrl());
  const [remoteSyncFeedback, setRemoteSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTestingRemoteSync, setIsTestingRemoteSync] = useState(false);
  const [pcLocalIps, setPcLocalIps] = useState<string[]>([]);
  const [pcPort, setPcPort] = useState<number>(3000);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  useEffect(() => {
    checkFirestore();

    // Query PC local network IPs if running on PC/web
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.ips)) {
          setPcLocalIps(data.ips);
          if (data.port) setPcPort(data.port);
        }
      })
      .catch(() => {});
  }, []);

  const checkFirestore = async () => {
    setIsCheckingFirestore(true);
    try {
      const diag = await getFirestoreDiagnostic();
      setFirestoreStatus(diag);
    } catch (e: any) {
      setFirestoreStatus({ status: 'error', message: e?.message || 'تعذر فحص الاتصال' });
    } finally {
      setIsCheckingFirestore(false);
    }
  };

  const handleRemoteSync = async () => {
    setRemoteSyncFeedback(null);
    setIsTestingRemoteSync(true);
    try {
      const res = await syncFromRemoteUrl(serverUrlInput);
      setRemoteSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
    } catch (err: any) {
      setRemoteSyncFeedback({
        type: 'error',
        message: err?.message || 'حدث خطأ أثناء المزامنة'
      });
    } finally {
      setIsTestingRemoteSync(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2500);
  };

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    updateSettings({
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      phone: cleanPhone,
      address: address.trim(),
      currency: currency.trim() || 'د.ع',
      defaultCategory: defaultCategory.trim() || 'عام',
      invoiceFooterNote: invoiceFooterNote.trim(),
      printFormat,
      enableWholesale,
      desktopLayout,
    });

    // Also sync phone number to user account on server so login via phone number works immediately
    if (currentUser?.uid && cleanPhone) {
      updateCurrentUserProfile({
        phone: cleanPhone,
        storeName: storeName.trim(),
        displayName: ownerName.trim()
      }, currentUser.uid);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 4) {
      setPasswordFeedback({ type: 'error', message: 'يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.' });
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setPasswordFeedback({ type: 'error', message: 'كلمة المرور وتأكيدها غير متطابقين.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeCurrentUserPassword(cleanPass, currentUser?.uid);
      setPasswordFeedback({ type: 'success', message: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول.' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordFeedback(null), 4000);
    } catch (err: any) {
      console.error("Change password error:", err);
      setPasswordFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تغيير كلمة المرور.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataJSON(content);
      if (res.success) {
        setImportStatus('تمت استعادة البيانات بنجاح!');
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        alert(res.error || 'فشلت استعادة البيانات من الملف');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من استعادة البيانات النموذجية الأولية؟ سيتم مسح التغييرات الحالية غير المحفوظة.')) {
      resetToDemo();
      alert('تمت إعادة ضبط البيانات النموذجية بنجاح.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Admin Panel: Loaded conditionally via React.lazy so clients NEVER download or bundle admin code */}
      {isAdmin && (
        <Suspense fallback={
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center text-emerald-400 font-bold flex items-center justify-center gap-2 shadow-lg">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>جاري تحميل لوحة تحكم الإدارة العليا بأمان...</span>
          </div>
        }>
          <AdminPanel />
        </Suspense>
      )}

      {/* Cloud Account & Database Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">الربط السحابي والمزامنة</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  متصل وقيد المزامنة
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser ? (
                  <>
                    الحساب: <strong className="text-white">{currentUser.displayName || currentUser.email}</strong> · مزامنة كاملة لجميع الأجهزة
                  </>
                ) : (
                  'أنت تعمل حالياً في وضع الضيف المحلي دون تسجيل حساب'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="تسجيل الخروج من الحساب الحالي"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>تسجيل الخروج</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Card for Current Account (Admin or Client) */}
      {currentUser && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">أمان الحساب وتغيير كلمة المرور</h2>
                <p className="text-xs text-slate-400">
                  تغيير كلمة المرور لحسابك الحالي ({currentUser.displayName || currentUser.email})
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isAdmin ? 'حساب المدير العام' : 'حساب زبون'}</span>
            </span>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            {passwordFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                passwordFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور للتأكيد"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                {isChangingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>حفظ وتحديث كلمة المرور</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Store Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">بيانات المحل والقوائم</h2>
              <p className="text-xs text-slate-400">تظهر هذه المعلومات في ترويسة وتذييل الفواتير المطبوعة</p>
            </div>
          </div>

          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              تم حفظ التعديلات بنجاح!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المحل أو المعرض / الشركة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم صاحب المحل / الإدارة
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف (يظهر في القوائم)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان والموقع التجاري
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العملة المعتمدة
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="د.ع"
                  className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex-1 text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الفئة الأساسية (الفئة الافتراضية للمواد)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  placeholder="عام"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={COMMON_DEFAULT_CATEGORIES.includes(defaultCategory) ? defaultCategory : ''}
                  onChange={(e) => {
                    if (e.target.value) setDefaultCategory(e.target.value);
                  }}
                  className="w-40 text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700"
                >
                  <option value="">-- خيارات الفئات --</option>
                  {COMMON_DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">تكون هذه الفئة محددة افتراضياً عند إضافة المواد أو التصفح، ويمكن تغييرها في أي وقت</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نمط الطباعة الافتراضي للقوائم
              </label>
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value as 'a4' | 'thermal')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="a4">فاتورة قياس A4 رسمية كاملة</option>
                <option value="thermal">وصل كاشير حراري قياس 80mm</option>
              </select>
            </div>
          </div>

          {/* Wholesale Mode Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  نظام البيع بالجملة وأسعار الجملة
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  حدد ما إذا كان المحل يبيع بالجملة والمفرد، أو يبيع بالمفرد فقط لإخفاء خيارات الجملة
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Enabled (Wholesale + Retail) */}
              <div
                onClick={() => setEnableWholesale(true)}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  enableWholesale
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wholesaleMode"
                  checked={enableWholesale}
                  onChange={() => setEnableWholesale(true)}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    محل يبيع جملة ومفرد (تفعيل الجملة)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    إظهار أسعار الجملة، وأزرار البيع بالجملة السريعة في نقطة البيع والقوائم.
                  </div>
                </div>
              </div>

              {/* Option 2: Disabled (Retail Only) */}
              <div
                onClick={() => setEnableWholesale(false)}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  !enableWholesale
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wholesaleMode"
                  checked={!enableWholesale}
                  onChange={() => setEnableWholesale(false)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    محل مفرد وتجزئة فقط (إلغاء بيع الجملة)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    إخفاء أسعار وأزرار البيع بالجملة من شاشة البيع، والاعتماد على سعر المفرد فقط.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout Mode: Full Computer Mode vs Partial Computer Mode */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-800 block">
                نظام عرض شاشة الكمبيوتر (وضع الحاسبة)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                اختر طريقة عرض المواد والقوائم على شاشة الكمبيوتر والحاسبة
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Full Computer Mode (الأساسي والافتراضي) */}
              <div
                onClick={() => setDesktopLayout('full')}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  desktopLayout === 'full'
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="desktopLayoutMode"
                  checked={desktopLayout === 'full'}
                  onChange={() => setDesktopLayout('full')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>وضع الكمبيوتر الكامل</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                      الأساسي والافتراضي
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    شاشة مستطيلة عريضة وجانبية: تظهر المواد وبجانبها القائمة مباشرة دون الحاجة للاختيار من الخيارات العلوية.
                  </div>
                </div>
              </div>

              {/* Option 2: Partial Computer Mode (الوضع السابق بالتبويبات) */}
              <div
                onClick={() => setDesktopLayout('partial')}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  desktopLayout === 'partial'
                    ? 'bg-white border-slate-700 ring-2 ring-slate-400/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="desktopLayoutMode"
                  checked={desktopLayout === 'partial'}
                  onChange={() => setDesktopLayout('partial')}
                  className="mt-0.5 text-slate-700 focus:ring-slate-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    وضع الكمبيوتر الجزئي
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    شاشة التبويبات العلوية المنفصلة: تقسيم البرنامج إلى صفحات مستقلة للمبيعات والمخزون والفواتير والتقارير.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظة أسفل القوائم (شروط الاستبدال، الختم)
            </label>
            <textarea
              rows={2}
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer"
            >
              حفظ إعدادات المحل
            </button>
          </div>

        </form>

      </div>

      {/* Device Sync & Linking: Android <-> PC <-> Cloud Firestore */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Smartphone className="w-5 h-5 inline-block" />
              <Laptop className="w-5 h-5 inline-block -mr-1" />
            </div>
            <h3 className="font-bold text-base text-slate-900">مزامنة الأجهزة: ربط تطبيق الأندرويد مع الكمبيوتر والسحابة</h3>
          </div>
          <p className="text-xs text-slate-500">
            الحل الشامل لمزامنة المواد والحسابات والفواتير عبر السحابة (إنترنت) أو مباشرة عبر شبكة الواي فاي المحلية
          </p>
        </div>

        {/* Section 1: Cloud Firestore Status */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">1. المزامنة السحابية العامة (Firebase Cloud Firestore):</span>
            </div>
            <button
              type="button"
              onClick={checkFirestore}
              disabled={isCheckingFirestore}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingFirestore ? 'animate-spin' : ''}`} />
              <span>فحص حالة السحابة</span>
            </button>
          </div>

          {firestoreStatus?.status === 'ok' ? (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>قاعدة بيانات Cloud Firestore متصلة وجاهزة للمزامنة التلقائية عبر الإنترنت.</span>
              </div>
              <button
                type="button"
                onClick={syncNow}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold cursor-pointer shrink-0 transition"
              >
                {isSyncing ? 'جاري الرفع...' : 'رفع ومزامنة المواد الآن'}
              </button>
            </div>
          ) : firestoreStatus?.status === 'disabled' ? (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2 text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-amber-900">قاعدة بيانات Cloud Firestore غير مفعلة في مشروعك (list-3d848)</div>
                  <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                    لتفعيل المزامنة التلقائية العالمية بين تطبيق الأندرويد والكمبيوتر دون الحاجة لشبكة الواي فاي:
                    <ol className="list-decimal list-inside mt-1.5 space-y-1 font-medium">
                      <li>افتح لوحة تحكم فايربيس الخاصة بمشروعك: <strong>Firebase Console</strong></li>
                      <li>انتقل إلى <strong>Firestore Database</strong> واضغط على زر <strong>Create database</strong></li>
                      <li>اختر <strong>Start in test mode</strong> ثم اضغط تم.</li>
                    </ol>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href="https://console.firebase.google.com/project/list-3d848/firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition inline-flex"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح Firebase Console لإنشاء قاعدة البيانات</span>
                </a>
                <button
                  type="button"
                  onClick={checkFirestore}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                >
                  إعادة فحص الاتصال
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>جاري التحقق من حالة الاتصال بـ Cloud Firestore...</span>
            </div>
          )}
        </div>

        {/* Section 2: Direct Local Wi-Fi / Server Sync */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3.5">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900">2. الربط المباشر مع سيرفر الكمبيوتر عبر شبكة الواي فاي (مزامنة فورية):</span>
          </div>

          {/* If on PC / Web: Show Local IP address */}
          {pcLocalIps.length > 0 && (
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>عنوان هذا الكمبيوتر على شبكة الواي فاي:</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                  جاهز للاتصال
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                في تطبيق الأندرويد على هاتفك: اكتب هذا العنوان في خانة "عنوان سيرفر الكمبيوتر" واضغط مزامنة:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {pcLocalIps.map((ip) => {
                  const fullUrl = `http://${ip}:${pcPort}`;
                  return (
                    <div
                      key={ip}
                      className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-800"
                    >
                      <span>{fullUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(fullUrl)}
                        className="text-slate-500 hover:text-emerald-600 cursor-pointer p-0.5"
                        title="نسخ العنوان"
                      >
                        {copiedIp === fullUrl ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Android Input / Custom Server URL */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              عنوان سيرفر الكمبيوتر (للهواتف وتطبيق الأندرويد):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="مثال: http://192.168.1.15:3000"
                className="flex-1 px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              <button
                type="button"
                onClick={handleRemoteSync}
                disabled={isTestingRemoteSync}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingRemoteSync ? 'animate-spin' : ''}`} />
                <span>{isTestingRemoteSync ? 'جاري الاتصال والمزامنة...' : 'اتصال ومزامنة المواد والحسابات الآن'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              عند الضغط، يتم نقل ومزامنة جميع المواد والحسابات والفواتير بين الكمبيوتر وهاتفك فوراً.
            </p>
          </div>

          {remoteSyncFeedback && (
            <div
              className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
                remoteSyncFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {remoteSyncFeedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{remoteSyncFeedback.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Backup & Data Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div>
          <h3 className="font-bold text-base text-slate-900">النسخ الاحتياطي وإدارة البيانات</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            احفظ نسخة احتياطية من المواد والمبيعات والزبائن على جهازك للرجوع إليها بأي وقت
          </p>
        </div>

        {importStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Export JSON */}
          <button
            onClick={handleDownloadBackup}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-right flex flex-col justify-between transition group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">تحميل نسخة احتياطية</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                تنزيل ملف JSON يحفظ كافة البيانات
              </div>
            </div>
          </button>

          {/* Import JSON */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-slate-50 text-right flex flex-col justify-between transition group cursor-pointer"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">استعادة من ملف</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                رفع ملف نسخة احتياطية سابقة
              </div>
            </div>
          </div>

          {/* Reset Demo */}
          <button
            onClick={handleReset}
            className="p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 text-right flex flex-col justify-between transition group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center mb-2 group-hover:bg-rose-600 group-hover:text-white transition">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">استعادة البيانات النموذجية</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                إعادة ضبط المواد والقوائم للتجربة
              </div>
            </div>
          </button>

        </div>
      </div>

    </div>
  );
};
