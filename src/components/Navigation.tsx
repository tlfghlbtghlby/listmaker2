import React from 'react';
import { 
  ShoppingCart, 
  Boxes, 
  FileText, 
  Users, 
  BarChart3, 
  Settings 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type TabType = 'pos' | 'inventory' | 'invoices' | 'customers' | 'reports' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const { products, invoices, customers } = useApp();

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const activeDebtCustomers = customers.filter((c) => c.totalDebt > 0).length;

  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number | string; badgeColor?: string }[] = [
    {
      id: 'pos',
      label: 'نقطة البيع وقائمة جديدة',
      icon: <ShoppingCart className="w-4 h-4" />,
    },
    {
      id: 'inventory',
      label: 'المواد والمخزون',
      icon: <Boxes className="w-4 h-4" />,
      badge: lowStockCount > 0 ? `${lowStockCount} ناقص` : undefined,
      badgeColor: 'text-rose-600 bg-rose-50',
    },
    {
      id: 'invoices',
      label: 'سجل القوائم والفواتير',
      icon: <FileText className="w-4 h-4" />,
      badge: invoices.length,
      badgeColor: 'text-slate-600 bg-slate-100',
    },
    {
      id: 'customers',
      label: 'البيع الآجل وحسابات الديون',
      icon: <Users className="w-4 h-4" />,
      badge: activeDebtCustomers > 0 ? `${activeDebtCustomers} مدين` : undefined,
      badgeColor: 'text-amber-700 bg-amber-50',
    },
    {
      id: 'reports',
      label: 'الأرباح والتقارير المالية',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'الإعدادات والنسخ الاحتياطي',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 space-x-reverse overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
