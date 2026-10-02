import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { X, Package, TrendingUp, AlertCircle, Sparkles, Box } from 'lucide-react';
import { getCartonBreakdown } from '../utils/cartonUtils';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

const COMMON_CATEGORIES = [
  'مواد غذائية',
  'كهربائيات',
  'مواد إنشائية',
  'أدوات منزلية',
  'صحيات وسباكة',
  'منظفات',
  'قرطاسية',
  'قطع غيار',
  'عام',
];

const COMMON_UNITS = [
  'قطعة',
  'كرتونة',
  'كيس',
  'كيلو',
  'لتر',
  'متر',
  'صندوق',
  'درزن (12)',
  'لفة',
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { addProduct, updateProduct, settings, products } = useApp();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [unit, setUnit] = useState(COMMON_UNITS[0]);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>(30);
  const [piecesPerCarton, setPiecesPerCarton] = useState<number | ''>(6);
  const [minStock, setMinStock] = useState<number | ''>(6);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCode(productToEdit.code);
      setCategory(productToEdit.category);
      setUnit(productToEdit.unit);
      setCostPrice(productToEdit.costPrice);
      setRetailPrice(productToEdit.retailPrice);
      setWholesalePrice(productToEdit.wholesalePrice);
      setStock(productToEdit.stock);
      setPiecesPerCarton(productToEdit.piecesPerCarton || 6);
      setMinStock(productToEdit.minStock);
      setNotes(productToEdit.notes || '');
    } else {
      // Auto-assign next code
      const nextCode = `${1000 + products.length + 1}`;
      setName('');
      setCode(nextCode);
      setCategory(COMMON_CATEGORIES[0]);
      setUnit(COMMON_UNITS[0]);
      setCostPrice('');
      setRetailPrice('');
      setWholesalePrice('');
      setStock(30);
      setPiecesPerCarton(6);
      setMinStock(6);
      setNotes('');
    }
    setErrors({});
  }, [productToEdit, isOpen, products.length]);

  if (!isOpen) return null;

  // Real-time profit calculations
  const numCost = typeof costPrice === 'number' ? costPrice : 0;
  const numRetail = typeof retailPrice === 'number' ? retailPrice : 0;
  const numWholesale = typeof wholesalePrice === 'number' ? wholesalePrice : 0;

  const retailProfit = numRetail - numCost;
  const retailMarginPercent = numCost > 0 ? ((retailProfit / numCost) * 100).toFixed(1) : '0';

  const wholesaleProfit = numWholesale - numCost;
  const wholesaleMarginPercent = numCost > 0 ? ((wholesaleProfit / numCost) * 100).toFixed(1) : '0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'اسم المادة مطلوب';
    if (costPrice === '' || Number(costPrice) < 0) newErrors.costPrice = 'سعر الجملة / الشراء مطلوب';
    if (retailPrice === '' || Number(retailPrice) < 0) newErrors.retailPrice = 'سعر البيع المباشر مطلوب';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const ppc = piecesPerCarton === '' || Number(piecesPerCarton) < 1 ? 1 : Number(piecesPerCarton);

    const payload = {
      name: name.trim(),
      code: code.trim() || `${Date.now()}`,
      category: category.trim(),
      unit: unit.trim(),
      costPrice: Number(costPrice),
      retailPrice: Number(retailPrice),
      wholesalePrice: wholesalePrice === '' ? Number(retailPrice) : Number(wholesalePrice),
      stock: stock === '' ? 0 : Number(stock),
      piecesPerCarton: ppc,
      minStock: minStock === '' ? 0 : Number(minStock),
      notes: notes.trim(),
    };

    if (productToEdit) {
      updateProduct(productToEdit.id, payload);
    } else {
      addProduct(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {productToEdit ? 'تعديل بيانات وأسعار المادة' : 'إدخال مادة جديدة إلى المخزن'}
              </h2>
              <p className="text-xs text-slate-400">
                حدد سعر الشراء بالجملة وسعر البيع لحساب أرباحك تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Row 1: Name and Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المادة / الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: زيت نباتي ممتاز، إسمنت مقاوم، كيبل نحاس 2.5..."
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.name && (
                <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.name}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الرمز أو الباركود
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="1001"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Row 2: Category and Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التصنيف / الفئة
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="حدد أو اكتب فئة المادة"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700"
                >
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                وحدة القياس / التعبئة
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="قطعة، كرتونة، كيس..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 3: Pricing Core (Wholesale Cost, Retail Price, Wholesale Selling Price) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                هيكل الأسعار وحساب الأرباح ({settings.currency})
              </span>
              <span className="text-[11px] text-slate-500">
                يحسب البرنامج الأرباح تلقائياً بناءً على التكلفة والبيع
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cost Price */}
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  سعر الشراء / الجملة (التكلفة) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                    errors.costPrice ? 'border-rose-400' : 'border-emerald-300'
                  }`}
                />
                {errors.costPrice && (
                  <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.costPrice}</span>
                )}
              </div>

              {/* Retail Selling Price */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  سعر البيع المباشر (تجزئة) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                    errors.retailPrice ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {errors.retailPrice && (
                  <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.retailPrice}</span>
                )}
              </div>

              {/* Wholesale Selling Price - only if wholesale mode is enabled */}
              {settings.enableWholesale && (
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    سعر بيع الجملة (اختياري)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={retailPrice ? String(retailPrice) : '0.00'}
                    className="w-full px-3 py-2 text-sm font-bold border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Profit Margin Indicator */}
            {numCost > 0 && numRetail > 0 && (
              <div className={`grid ${settings.enableWholesale ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2 border-t border-slate-200 text-xs`}>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">صافي ربح المادة (مفرد):</span>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-700">
                      +{retailProfit.toLocaleString()} {settings.currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      (نسبة هامش ربح: {retailMarginPercent}%)
                    </span>
                  </div>
                </div>

                {settings.enableWholesale && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">ربح بيع الجملة (للقطعة):</span>
                    <div className="text-right">
                      <span className="font-extrabold text-blue-700">
                        +{wholesaleProfit.toLocaleString()} {settings.currency}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        (نسبة هامش: {wholesaleMarginPercent}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 4: Carton Capacity and Stock Management */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-emerald-700" />
                <span>نظام الكراتين وسعة التعبئة</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                ينقص الكراتين تلقائياً عند بيع القطع
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pieces per Carton */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  كم قطعة يحتوي الكارتون الواحد؟
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={piecesPerCarton}
                    onChange={(e) => {
                      const newPpc = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                      setPiecesPerCarton(newPpc);
                    }}
                    placeholder="6"
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    قطع/كارتون
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  حدد كمية الكارتون (مثال: 6 أو 12 قطعة، أو 1 إذا كانت المادة لا تُباع بالكرتون)
                </span>
              </div>

              {/* Total Stock in Pieces */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  إجمالي الرصيد بالمخزن (بالقطع)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="30"
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    قطعة
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  يمكنك إدخال إجمالي القطع أو استخدام أزرار الكراتين السريعة بالأسفل
                </span>
              </div>
            </div>

            {/* Quick Carton Presets / Calculator */}
            {typeof piecesPerCarton === 'number' && piecesPerCarton > 1 && (
              <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold text-slate-700">تحديد الرصيد السريع بعدد الكراتين:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5, 10, 20].map((numCartons) => (
                      <button
                        key={numCartons}
                        type="button"
                        onClick={() => setStock(numCartons * piecesPerCarton)}
                        className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                          stock === numCartons * piecesPerCarton
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {numCartons} كارتون ({numCartons * piecesPerCarton} ق)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Stock Breakdown Result */}
                {(() => {
                  const currentTotal = stock === '' ? 0 : Number(stock);
                  const breakdown = getCartonBreakdown(currentTotal, piecesPerCarton);
                  return (
                    <div className="bg-white border border-emerald-300 rounded-lg p-3 text-xs flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">الموجود الفعلي في المخزن حالياً:</span>
                        <strong className="text-emerald-800 font-extrabold text-sm">
                          {breakdown.formatted}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                        {breakdown.cartons} كارتون كامل + {breakdown.remainingPieces} قطعة متبقية
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Minimum Stock Alert */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الحد الأدنى للتنبيه عند النقص (بالقطع)
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                placeholder="6"
                className="w-full sm:w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات أو مواصفات إضافية
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: منشأ تركي، كفالة سنة، رقم الرف بالمستودع..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              {productToEdit ? 'حفظ التعديلات' : 'إضافة المادة للمخزن'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
