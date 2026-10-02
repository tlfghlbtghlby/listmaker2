import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Boxes, 
  ShoppingBag, 
  Users, 
  ArrowUpRight, 
  Calendar,
  Award
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { products, invoices, customers, payments, formatMoney, settings } = useApp();

  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Filter invoices by time
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    return invoices.filter((inv) => {
      const invDate = new Date(inv.date);
      if (timeFilter === 'today') {
        return invDate.toDateString() === now.toDateString();
      }
      if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        return (
          invDate.getMonth() === now.getMonth() &&
          invDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [invoices, timeFilter]);

  // Financial aggregates
  const totalSales = filteredInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalCost = filteredInvoices.reduce((sum, i) => sum + i.totalCost, 0);
  const totalNetProfit = filteredInvoices.reduce((sum, i) => sum + i.netProfit, 0);
  const profitMarginPercent = totalCost > 0 ? ((totalNetProfit / totalCost) * 100).toFixed(1) : '0';

  // Direct vs Credit breakdown
  const directInvoices = filteredInvoices.filter((i) => i.type === 'direct');
  const creditInvoices = filteredInvoices.filter((i) => i.type === 'credit');

  const directSalesTotal = directInvoices.reduce((sum, i) => sum + i.total, 0);
  const creditSalesTotal = creditInvoices.reduce((sum, i) => sum + i.total, 0);

  const directPercent = totalSales > 0 ? ((directSalesTotal / totalSales) * 100).toFixed(0) : '0';
  const creditPercent = totalSales > 0 ? ((creditSalesTotal / totalSales) * 100).toFixed(0) : '0';

  // Inventory valuation
  const inventoryCostValuation = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const inventoryRetailValuation = products.reduce((sum, p) => sum + p.retailPrice * p.stock, 0);
  const inventoryUnrealizedProfit = inventoryRetailValuation - inventoryCostValuation;

  // Total Market Debt
  const totalMarketDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);

  // Top selling products calculation
  const productSalesMap = useMemo(() => {
    const map: { [prodId: string]: { name: string; quantity: number; revenue: number; profit: number } } = {};

    filteredInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }
        map[item.productId].quantity += item.quantity;
        map[item.productId].revenue += item.total;
        map[item.productId].profit += (item.unitPrice - item.costPrice) * item.quantity;
      });
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      
      {/* Time filter segmented control */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">تقرير المبيعات وصافي الأرباح</h2>
          <p className="text-xs text-slate-400">تحليل دقيق بناءً على فرق أسعار الجملة وسعر البيع</p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded-md transition ${
              timeFilter === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1.5 rounded-md transition ${
              timeFilter === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 rounded-md transition ${
              timeFilter === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-md transition ${
              timeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            كامل الفترة
          </button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>إجمالي المبيعات</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatMoney(totalSales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            من {filteredInvoices.length} قائمة تم إنشاؤها
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>تكلفة البضاعة المباعة (جملة)</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700">
            {formatMoney(totalCost)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            سعر شراء المواد التي بيعت
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 mb-1 font-bold">
            <span>صافي الأرباح المحققة</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {formatMoney(totalNetProfit)}
          </div>
          <div className="text-[11px] text-emerald-800 font-semibold mt-1">
            نسبة هامش الربح: {profitMarginPercent}%
          </div>
        </div>

        {/* Market Debt */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-800 mb-1 font-bold">
            <span>ديون البيع الآجل بالسوق</span>
            <CreditCard className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {formatMoney(totalMarketDebt)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            مستحقة لدى الزبائن لم تُسدد
          </div>
        </div>

      </div>

      {/* Breakdown: Direct vs Credit Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Direct vs Credit Sales Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">
            مقارنة نوع المبيعات: بيع مباشر (نقدي) مقابل بيع آجل (دين)
          </h3>

          <div className="space-y-3">
            {/* Direct */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  البيع المباشر (نقدي): {formatMoney(directSalesTotal)}
                </span>
                <span className="text-slate-500">{directPercent}% ({directInvoices.length} قائمة)</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${directPercent}%` }}
                />
              </div>
            </div>

            {/* Credit */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  البيع الآجل (دين): {formatMoney(creditSalesTotal)}
                </span>
                <span className="text-slate-500">{creditPercent}% ({creditInvoices.length} قائمة)</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <p>
              💡 <strong>نصيحة مالية:</strong> نسبة البيع المباشر النقدية تضمن سيولة يومية لتسديد أثمان البضائع بسعر الجملة، بينما البيع الآجل يتطلب متابعة تواريخ الاستحقاق لتفادي ركود الديون.
            </p>
          </div>
        </div>

        {/* Current Inventory Valuation */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">
            تقييم ورأس مال المخزون الحالي
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-slate-500 block mb-1">رأس المال بالمخزن (تكلفة الجملة)</span>
              <strong className="text-base font-bold text-slate-900">
                {formatMoney(inventoryCostValuation)}
              </strong>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-slate-500 block mb-1">القيمة الإجمالية (سعر البيع)</span>
              <strong className="text-base font-bold text-slate-900">
                {formatMoney(inventoryRetailValuation)}
              </strong>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-emerald-900 block">إجمالي الربح المجمد بالمخزن:</span>
              <span className="text-emerald-700 text-[11px]">يتحقق بالكامل عند تصريف جميع المواد</span>
            </div>
            <strong className="text-lg font-black text-emerald-800">
              +{formatMoney(inventoryUnrealizedProfit)}
            </strong>
          </div>
        </div>

      </div>

      {/* Top Selling Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900">المواد الأكثر مبيعاً وتحقيقاً للأرباح</h3>
          </div>
          <span className="text-xs text-slate-500">
            مرتبة حسب أعلى إيرادات مبيعات
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">الترتيب</th>
                <th className="py-2.5 px-4">اسم المادة</th>
                <th className="py-2.5 px-4 text-center">الكمية المباعة</th>
                <th className="py-2.5 px-4">إجمالي الإيرادات</th>
                <th className="py-2.5 px-4 text-emerald-800">صافي الربح المحقق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productSalesMap.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    لا توجد بيانات مبيعات في الفترة المحددة
                  </td>
                </tr>
              ) : (
                productSalesMap.slice(0, 10).map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {formatMoney(item.revenue)}
                    </td>
                    <td className="py-2.5 px-4 font-extrabold text-emerald-700">
                      +{formatMoney(item.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
