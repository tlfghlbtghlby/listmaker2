import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ProductModal } from './components/ProductModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { AuthView } from './components/AuthView';
import { Product, Invoice } from './types';
import { 
  Boxes, 
  FileText, 
  Users, 
  BarChart3, 
  Settings, 
  ArrowRight
} from 'lucide-react';

const MainContent: React.FC = () => {
  const { settings, currentUser, authLoading } = useApp();
  const [isGuest, setIsGuest] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const isMobile = settings.deviceMode === 'mobile';
  const isFullComputerMode = !isMobile && (settings.desktopLayout === 'full');
  
  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Invoice print modal
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  const handleOpenNewProduct = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setProductToEdit(prod);
    setIsProductModalOpen(true);
  };

  const handleInvoiceCreated = (invoice: Invoice) => {
    // Show print dialog immediately after invoice creation
    setInvoiceToPrint(invoice);
  };

  // Show loading spinner while determining auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white" dir="rtl">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-base font-bold">جاري تحميل نظام المبيعات والمخزن...</div>
        <div className="text-xs text-slate-400 mt-1">الربط والمزامنة السحابية</div>
      </div>
    );
  }

  // If not logged in and not guest, show the Login screen directly
  // No store data is displayed until the user logs into their specific account
  if (!currentUser && !isGuest) {
    return (
      <AuthView
        onSuccess={() => setIsGuest(false)}
        onContinueAsGuest={() => setIsGuest(true)}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-100 text-slate-800 ${isMobile ? 'selection:bg-emerald-600' : ''}`}>
      {/* Top Header */}
      <Header 
        onOpenAuth={() => setIsGuest(false)}
      />

      {/* Main Tab Navigation: يظهر في وضع الكمبيوتر الجزئي أو وضع الهاتف فقط */}
      {!isFullComputerMode && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Active Tab View */}
      <main className={`flex-1 w-full mx-auto ${
        isMobile 
          ? 'max-w-2xl px-2.5 sm:px-4 py-3 sm:py-4' 
          : isFullComputerMode 
          ? 'max-w-[1600px] px-3 sm:px-6 py-3 sm:py-4' 
          : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-5'
      }`}>
        
        {/* في وضع الكمبيوتر الكامل: شريط عودة سريع إذا انتقل المستخدم لصفحة أخرى */}
        {isFullComputerMode && activeTab !== 'pos' && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between mb-4 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-400">أنت تتصفح حالياً:</span>
              <span className="text-emerald-400">
                {activeTab === 'inventory' && 'جدول المخزون الكامل'}
                {activeTab === 'invoices' && 'سجل الفواتير والقوائم'}
                {activeTab === 'customers' && 'حسابات الديون والعملاء'}
                {activeTab === 'reports' && 'الأرباح والتقارير المالية'}
                {activeTab === 'settings' && 'الإعدادات العامة والنسخ الاحتياطي'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لشاشة المواد وقائمة البيع (وضع الكمبيوتر الكامل)</span>
            </button>
          </div>
        )}

        {/* في وضع الكمبيوتر الكامل: شريط أدوات علوي مصغر للانتقال السريع دون إخفاء شاشة البيع الأساسية */}
        {isFullComputerMode && activeTab === 'pos' && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-2 sm:px-3 rounded-xl border border-slate-200 shadow-2xs text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>وضع الكمبيوتر الكامل</span>
              </span>
              <span className="text-slate-500 text-xs hidden md:inline">
                (المواد على اليمين وبجانبها القائمة مباشرة بشكل مستطيل وجانبي)
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض جدول المواد والمخزون الكامل"
              >
                <Boxes className="w-3.5 h-3.5 text-slate-500" />
                <span>المخزون الكامل</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض سجل الفواتير والقوائم السابقة"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>سجل الفواتير</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض حسابات ديون العملاء والبيع الآجل"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>الديون والعملاء</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض الأرباح والتقارير المالية"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                <span>التقارير</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="فتح إعدادات النظام والنسخ الاحتياطي"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>الإعدادات</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
          <POSView
            onInvoiceCreated={handleInvoiceCreated}
            onOpenNewProduct={handleOpenNewProduct}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            onOpenNewProduct={handleOpenNewProduct}
            onEditProduct={handleOpenEditProduct}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </main>

      {/* Product Add/Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        productToEdit={productToEdit}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
        }}
      />

      {/* Invoice Print & Preview Modal */}
      <InvoicePrintModal
        invoice={invoiceToPrint}
        onClose={() => setInvoiceToPrint(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
