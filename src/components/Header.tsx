import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShoppingBag, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle,
  Monitor,
  Smartphone,
  Tag,
  EyeOff,
  Cloud,
  WifiOff,
  LogOut,
  LogIn,
  Store,
  RefreshCw
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth }) => {
  const { 
    products, 
    invoices, 
    customers, 
    settings, 
    updateSettings, 
    formatMoney,
    currentUser,
    logout,
    isCloudConnected,
    syncNow,
    isSyncing,
    lastSyncTime
  } = useApp();

  // Metrics calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter((inv) => inv.date.startsWith(todayStr));
  const todaySalesTotal = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayProfitTotal = todayInvoices.reduce((sum, inv) => sum + inv.netProfit, 0);

  const totalMarketDebt = customers.reduce((sum, cust) => sum + cust.totalDebt, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const isMobile = settings.deviceMode === 'mobile';

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 space-y-3">
        
        {/* Main Row: اسم المحل والتحكم بدون أي تداخل أو قص للكلمات */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Right Side: اسم المحل والشارة وحالة المزامنة */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md font-black text-xl shrink-0">
                {settings.storeName ? settings.storeName.charAt(0) : <Store className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                    {settings.storeName}
                  </h1>
                  <span className="text-xs text-slate-400 hidden sm:inline">·</span>
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md">
                    نظام المبيعات والمخزن
                  </span>
                </div>
                {settings.ownerName && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    إدارة: <span className="text-slate-200 font-medium">{settings.ownerName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Offline/Online status badge (Mobile quick badge) */}
            {currentUser && (
              <div className="lg:hidden">
                {isCloudConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold whitespace-nowrap">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>متصل سحابياً</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold whitespace-nowrap">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>محلي</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Left Side: أزرار التحكم كاملة الكلمات بدون أي قص أو نقاط */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Instant Sync Button (زر المزامنة الفورية في أعلى الشاشة) */}
            {currentUser && (
              <button
                type="button"
                onClick={syncNow}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap ${
                  isSyncing
                    ? 'bg-emerald-700 text-white border-emerald-600 opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                }`}
                title="اضغط هنا للمزامنة الفورية لنقل المواد والبيانات بين هذا الجهاز والأجهزة الأخرى المسجلة بنفس الحساب"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة فورية'}</span>
                {lastSyncTime && (
                  <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">
                    {lastSyncTime}
                  </span>
                )}
              </button>
            )}

            {/* Wholesale Price Visibility Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ enableWholesale: !settings.enableWholesale })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer whitespace-nowrap ${
                settings.enableWholesale
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={
                settings.enableWholesale
                  ? 'سعر بيع الجملة ظاهر (انقر لإخفائه، وسيبقى سعر تكلفة الجملة ظاهراً دائماً)'
                  : 'سعر بيع الجملة مخفي (انقر لإظهاره)'
              }
            >
              {settings.enableWholesale ? (
                <>
                  <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>سعر بيع الجملة: ظاهر</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>سعر بيع الجملة: مخفي</span>
                </>
              )}
            </button>

            {/* Device Mode Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ deviceMode: isMobile ? 'desktop' : 'mobile' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap ${
                isMobile
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                  : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
              }`}
              title={isMobile ? 'أنت في وضع الهاتف - انقر للتحويل إلى وضع الحاسبة' : 'أنت في وضع الحاسبة - انقر للتحويل إلى وضع الهاتف'}
            >
              {isMobile ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>وضع الهاتف</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>وضع الحاسبة</span>
                </>
              )}
            </button>

            {/* Desktop Layout Mode Switcher */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => updateSettings({ desktopLayout: settings.desktopLayout === 'full' ? 'partial' : 'full' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer whitespace-nowrap ${
                  settings.desktopLayout === 'full'
                    ? 'bg-indigo-600/30 border-indigo-400/60 text-indigo-200 hover:bg-indigo-600/40'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={
                  settings.desktopLayout === 'full'
                    ? 'أنت في وضع الكمبيوتر الكامل (شاشة مستطيلة عريضة جانبية)'
                    : 'أنت في وضع الكمبيوتر الجزئي (التبويبات)'
                }
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span>{settings.desktopLayout === 'full' ? 'الوضع الكامل الجانبي' : 'الوضع الجزئي (تبويبات)'}</span>
              </button>
            )}

            {/* Cloud User Account & Sync Status & Logout */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                <div 
                  className={`flex items-center gap-1.5 ${isCloudConnected ? 'text-emerald-400' : 'text-amber-400'}`} 
                  title={isCloudConnected ? 'الحساب متصل سحابياً مع السيرفر والأجهزة الأخرى' : 'العمل بالذاكرة المحلية (أوفلاين) ويُزامن تلقائياً عند توفر الإنترنت'}
                >
                  {isCloudConnected ? <Cloud className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-[11px] font-bold hidden xl:inline">
                    {isCloudConnected ? 'سحابي متصل' : 'محلي (أوفلاين)'}
                  </span>
                </div>
                
                <span className="font-bold text-slate-200 border-r border-slate-700 pr-2">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>

                <button
                  type="button"
                  onClick={logout}
                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                  title="تسجيل الخروج والعودة لشاشة الدخول"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 transition cursor-pointer shadow-xs whitespace-nowrap"
                    title="تسجيل الدخول إلى حسابك السحابي"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>تسجيل الدخول</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Second Row: التفاصيل والإحصائيات السريعة */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none text-xs pt-1 border-t border-slate-800/80">
          
          {/* Today Sales */}
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">مبيعات اليوم ({todayInvoices.length} قائمة)</span>
              <span className="font-bold text-white text-xs">{formatMoney(todaySalesTotal)}</span>
            </div>
          </div>

          {/* Today Profit */}
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">أرباح اليوم الصافية</span>
              <span className="font-bold text-emerald-400 text-xs">{formatMoney(todayProfitTotal)}</span>
            </div>
          </div>

          {/* Total Market Debt */}
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">ديون السوق (البيع الآجل)</span>
              <span className="font-bold text-amber-300 text-xs">{formatMoney(totalMarketDebt)}</span>
            </div>
          </div>

          {/* Low Stock Warning */}
          {lowStockCount > 0 && (
            <div className="bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-rose-200 shrink-0 whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-xs font-bold">{lowStockCount} مواد قاربت على النفاد بالمخزن</span>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
