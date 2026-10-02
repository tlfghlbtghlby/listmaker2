import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  ArrowUpDown, 
  Boxes,
  TrendingUp,
  Tag,
  Download,
  Filter,
  Box
} from 'lucide-react';
import { getCartonBreakdown } from '../utils/cartonUtils';

interface InventoryViewProps {
  onOpenNewProduct: () => void;
  onEditProduct: (product: Product) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenNewProduct,
  onEditProduct,
}) => {
  const { products, deleteProduct, adjustStock, formatMoney, settings } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'profit' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((prod) => {
        const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          !q ||
          prod.name.toLowerCase().includes(q) ||
          prod.code.toLowerCase().includes(q) ||
          prod.category.toLowerCase().includes(q);

        let matchStock = true;
        if (stockFilter === 'low') {
          matchStock = prod.stock <= prod.minStock && prod.stock > 0;
        } else if (stockFilter === 'out') {
          matchStock = prod.stock <= 0;
        }

        return matchCat && matchSearch && matchStock;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name') diff = a.name.localeCompare(b.name, 'ar');
        else if (sortBy === 'stock') diff = a.stock - b.stock;
        else if (sortBy === 'price') diff = a.retailPrice - b.retailPrice;
        else if (sortBy === 'profit') {
          const profitA = a.retailPrice - a.costPrice;
          const profitB = b.retailPrice - b.costPrice;
          diff = profitA - profitB;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [products, selectedCategory, searchQuery, stockFilter, sortBy, sortOrder]);

  // Overall Inventory Stats
  const totalItemsCount = products.reduce((sum, p) => sum + p.stock, 0);
  const totalCostValuation = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + p.retailPrice * p.stock, 0);
  const expectedProfitValuation = totalRetailValuation - totalCostValuation;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const handleDelete = (prod: Product) => {
    if (confirm(`هل أنت متأكد من حذف المادة (${prod.name}) من المخزن؟`)) {
      deleteProduct(prod.id);
    }
  };

  const handleExportCSV = () => {
    const headers = ['الكود', 'اسم المادة', 'الفئة', 'الوحدة', 'سعر الجملة', 'سعر التجزئة', 'سعر بيع الجملة', 'الكمية بالمخزن', 'الحد الأدنى'];
    const rows = products.map((p) => [
      `"${p.code}"`,
      `"${p.name}"`,
      `"${p.category}"`,
      `"${p.unit}"`,
      p.costPrice,
      p.retailPrice,
      p.wholesalePrice,
      p.stock,
      p.minStock,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `قائمة_المواد_والمخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Valuation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">إجمالي أنواع المواد بالمخزن</div>
          <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
            <span>{products.length} صنف</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {totalItemsCount} قطعة/وحدة
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">قيمة المخزون بسعر الجملة (التكلفة)</div>
          <div className="text-2xl font-black text-slate-900">
            {formatMoney(totalCostValuation)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">قيمة المخزون بسعر البيع (المتوقع)</div>
          <div className="text-2xl font-black text-emerald-700">
            {formatMoney(totalRetailValuation)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">الربح الصافي المتوقع عند تصريف المخزون</div>
          <div className="text-2xl font-black text-blue-700 flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span>{formatMoney(expectedProfitValuation)}</span>
          </div>
        </div>

      </div>

      {/* Control Bar: Search, Filters, Add Button */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المادة، الرمز، أو الباركود..."
              className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1.5 transition"
              title="تصدير جدول المواد إلى Excel/CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={onOpenNewProduct}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>إدخال مادة جديدة</span>
            </button>
          </div>

        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-slate-500 font-medium ml-1">التصنيف:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'الكل' : cat}
              </button>
            ))}
          </div>

          {/* Stock state filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium ml-1">حالة المخزن:</span>
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              الكل ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'low' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              قارب النفاد ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'out' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              نافد ({products.filter((p) => p.stock <= 0).length})
            </button>
          </div>

        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">الرمز</th>
                <th className="py-3 px-4">اسم المادة / الصنف</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4">الوحدة</th>
                <th className="py-3 px-4 text-emerald-800">سعر تكلفة الجملة (الشراء)</th>
                <th className="py-3 px-4 text-slate-900">سعر بيع المفرد</th>
                {settings.enableWholesale && (
                  <th className="py-3 px-4 text-blue-900">سعر بيع الجملة</th>
                )}
                <th className="py-3 px-4 text-slate-700">هامش الربح (مفرق)</th>
                <th className="py-3 px-4 text-center">الكمية المتوفرة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={settings.enableWholesale ? 10 : 9} className="py-12 text-center text-slate-400">
                    <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا توجد مواد مطابقة لخيارات البحث</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const retailProfit = prod.retailPrice - prod.costPrice;
                  const retailMarginPercent = prod.costPrice > 0 ? ((retailProfit / prod.costPrice) * 100).toFixed(0) : '100';
                  const isLow = prod.stock <= prod.minStock && prod.stock > 0;
                  const isOut = prod.stock <= 0;

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/70 transition group"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        #{prod.code}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{prod.name}</div>
                        {prod.notes && (
                          <div className="text-[11px] text-slate-400 font-normal">{prod.notes}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {prod.category}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {prod.unit}
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatMoney(prod.costPrice)}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatMoney(prod.retailPrice)}
                      </td>

                      {/* Wholesale Selling Price - only if wholesale enabled */}
                      {settings.enableWholesale && (
                        <td className="py-3 px-4 font-bold text-blue-700">
                          {formatMoney(prod.wholesalePrice)}
                        </td>
                      )}

                      {/* Margin */}
                      <td className="py-3 px-4 text-xs">
                        <div className="font-bold text-emerald-600">
                          +{formatMoney(retailProfit)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          ربح {retailMarginPercent}%
                        </div>
                      </td>

                      {/* Stock with quick +/- */}
                      <td className="py-3 px-4">
                        {(() => {
                          const ppc = prod.piecesPerCarton || 1;
                          const breakdown = getCartonBreakdown(prod.stock, ppc);
                          return (
                            <div className="flex flex-col items-center gap-1.5 min-w-[140px]">
                              <span
                                className={`text-center font-bold text-xs px-2.5 py-1 rounded-md whitespace-nowrap shadow-2xs ${
                                  isOut
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                                title={`إجمالي القطع بالمخزن: ${prod.stock} قطعة`}
                              >
                                {breakdown.formatted}
                              </span>

                              {/* Quick Adjustment Controls */}
                              <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => adjustStock(prod.id, -1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                  title="خصم قطعة واحدة"
                                >
                                  -1 ق
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(prod.id, 1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                  title="إضافة قطعة واحدة"
                                >
                                  +1 ق
                                </button>
                                {ppc > 1 && (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(prod.id, -ppc)}
                                      className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 transition"
                                      title={`خصم كارتون كامل (${ppc} قطعة)`}
                                    >
                                      -1 كارتون
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(prod.id, ppc)}
                                      className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition"
                                      title={`إضافة كارتون كامل (${ppc} قطعة)`}
                                    >
                                      +1 كارتون
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditProduct(prod)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="تعديل المادة والأسعار"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="حذف المادة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
