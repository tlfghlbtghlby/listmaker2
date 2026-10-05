import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { X, Package, TrendingUp, AlertCircle, Sparkles, Box, ScanLine, Camera, ArrowLeftRight } from 'lucide-react';
import { getCartonBreakdown } from '../utils/cartonUtils';
import { useBarcodeScanner, playBarcodeBeep } from '../utils/barcodeUtils';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialBarcode?: string;
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
  initialBarcode,
}) => {
  const { addProduct, updateProduct, settings, products } = useApp();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(settings.defaultCategory || COMMON_CATEGORIES[0]);
  const [unit, setUnit] = useState(COMMON_UNITS[0]);

  // Pricing Base: 'carton' or 'piece'
  const [pricingBase, setPricingBase] = useState<'carton' | 'piece'>('carton');
  const [piecesPerCarton, setPiecesPerCarton] = useState<number | ''>(12);

  // Piece prices (سعر القطعة)
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');

  // Carton prices (سعر الكرتون)
  const [cartonCostPrice, setCartonCostPrice] = useState<number | ''>('');
  const [cartonRetailPrice, setCartonRetailPrice] = useState<number | ''>('');
  const [cartonWholesalePrice, setCartonWholesalePrice] = useState<number | ''>('');

  // Stock (رصيد المخزن)
  const [stock, setStock] = useState<number | ''>(60);
  const [stockCartons, setStockCartons] = useState<number | ''>(5);
  const [minStock, setMinStock] = useState<number | ''>(12);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedNotification, setScannedNotification] = useState<string | null>(null);

  // Intercept hardware barcode scanners while modal is open
  useBarcodeScanner({
    isEnabled: isOpen && !isCameraOpen,
    onScan: (scanned) => {
      setCode(scanned);
      playBarcodeBeep(true);
      setScannedNotification(`تم التقاط الباركود: ${scanned}`);
      setTimeout(() => setScannedNotification(null), 3000);
    }
  });

  const getPpc = () => {
    const ppc = Number(piecesPerCarton);
    return ppc && ppc > 0 ? ppc : 1;
  };

  // Two-way synchronized price calculations:
  // سعر القطعة يحسب تلقائياً عند إدخال سعر الكرتون، مع إمكانية تعديل سعر القطعة بحرية دون التأثير على سعر الكرتون
  const handlePieceCostChange = (valStr: string) => {
    if (valStr === '') {
      setCostPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCostPrice(val);
  };

  const handleCartonCostChange = (valStr: string) => {
    if (valStr === '') {
      setCartonCostPrice('');
      setCostPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCartonCostPrice(val);
    const ppc = getPpc();
    const pieceVal = ppc > 0 ? val / ppc : val;
    setCostPrice(Math.round(pieceVal * 100) / 100);
  };

  const handlePieceRetailChange = (valStr: string) => {
    if (valStr === '') {
      setRetailPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setRetailPrice(val);
  };

  const handleCartonRetailChange = (valStr: string) => {
    if (valStr === '') {
      setCartonRetailPrice('');
      setRetailPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCartonRetailPrice(val);
    const ppc = getPpc();
    const pieceVal = ppc > 0 ? val / ppc : val;
    setRetailPrice(Math.round(pieceVal * 100) / 100);
  };

  const handlePieceWholesaleChange = (valStr: string) => {
    if (valStr === '') {
      setWholesalePrice('');
      return;
    }
    const val = parseFloat(valStr);
    setWholesalePrice(val);
  };

  const handleCartonWholesaleChange = (valStr: string) => {
    if (valStr === '') {
      setCartonWholesalePrice('');
      setWholesalePrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCartonWholesalePrice(val);
    const ppc = getPpc();
    const pieceVal = ppc > 0 ? val / ppc : val;
    setWholesalePrice(Math.round(pieceVal * 100) / 100);
  };

  const handlePpcChange = (newPpcVal: number) => {
    const validPpc = Math.max(1, newPpcVal);
    setPiecesPerCarton(validPpc);

    // عند تغيير سعة الكرتون، يتم تحديث سعر القطعة تلقائياً من سعر الكرتون
    if (typeof cartonCostPrice === 'number' && cartonCostPrice > 0) {
      setCostPrice(Math.round((cartonCostPrice / validPpc) * 100) / 100);
    }
    if (typeof cartonRetailPrice === 'number' && cartonRetailPrice > 0) {
      setRetailPrice(Math.round((cartonRetailPrice / validPpc) * 100) / 100);
    }
    if (typeof cartonWholesalePrice === 'number' && cartonWholesalePrice > 0) {
      setWholesalePrice(Math.round((cartonWholesalePrice / validPpc) * 100) / 100);
    }

    if (typeof stock === 'number') {
      setStockCartons(Math.floor(stock / validPpc));
    }
  };

  const handleStockPiecesChange = (valStr: string) => {
    if (valStr === '') {
      setStock('');
      setStockCartons('');
      return;
    }
    const val = Math.max(0, parseInt(valStr) || 0);
    setStock(val);
    const ppc = getPpc();
    setStockCartons(Math.floor(val / ppc));
  };

  const handleStockCartonsChange = (valStr: string) => {
    if (valStr === '') {
      setStockCartons('');
      setStock('');
      return;
    }
    const val = Math.max(0, parseInt(valStr) || 0);
    setStockCartons(val);
    const ppc = getPpc();
    setStock(val * ppc);
  };

  useEffect(() => {
    if (productToEdit) {
      const ppc = productToEdit.piecesPerCarton && productToEdit.piecesPerCarton > 1 ? productToEdit.piecesPerCarton : 12;
      setName(productToEdit.name);
      setCode(productToEdit.code);
      setCategory(productToEdit.category);
      setUnit(productToEdit.unit);
      
      const cp = productToEdit.costPrice;
      const rp = productToEdit.retailPrice;
      const wp = productToEdit.wholesalePrice;

      setCostPrice(cp);
      setCartonCostPrice(
        typeof productToEdit.cartonCostPrice === 'number'
          ? productToEdit.cartonCostPrice
          : (typeof cp === 'number' ? Math.round(cp * ppc) : '')
      );
      setRetailPrice(rp);
      setCartonRetailPrice(
        typeof productToEdit.cartonRetailPrice === 'number'
          ? productToEdit.cartonRetailPrice
          : (typeof rp === 'number' ? Math.round(rp * ppc) : '')
      );
      setWholesalePrice(wp);
      setCartonWholesalePrice(
        typeof productToEdit.cartonWholesalePrice === 'number'
          ? productToEdit.cartonWholesalePrice
          : (typeof wp === 'number' ? Math.round(wp * ppc) : '')
      );

      setStock(productToEdit.stock);
      setStockCartons(typeof productToEdit.stock === 'number' ? Math.floor(productToEdit.stock / ppc) : '');
      setPiecesPerCarton(ppc);
      setMinStock(productToEdit.minStock);
      setNotes(productToEdit.notes || '');
    } else {
      const nextCode = initialBarcode ? initialBarcode.trim() : `${1000 + products.length + 1}`;
      const defaultPpc = 12;
      setName('');
      setCode(nextCode);
      setCategory(settings.defaultCategory || COMMON_CATEGORIES[0]);
      setUnit(COMMON_UNITS[0]);
      setCostPrice('');
      setCartonCostPrice('');
      setRetailPrice('');
      setCartonRetailPrice('');
      setWholesalePrice('');
      setCartonWholesalePrice('');
      setStock(60);
      setStockCartons(5);
      setPiecesPerCarton(defaultPpc);
      setMinStock(12);
      setNotes('');
    }
    setErrors({});
  }, [productToEdit, isOpen, initialBarcode, products.length]);

  if (!isOpen) return null;

  // Real-time profit calculations per piece
  const numCost = typeof costPrice === 'number' ? costPrice : 0;
  const numRetail = typeof retailPrice === 'number' ? retailPrice : 0;
  const numWholesale = typeof wholesalePrice === 'number' ? wholesalePrice : 0;
  const ppc = getPpc();

  const retailProfit = numRetail - numCost;
  const retailMarginPercent = numCost > 0 ? ((retailProfit / numCost) * 100).toFixed(1) : '0';

  const wholesaleProfit = numWholesale - numCost;
  const wholesaleMarginPercent = numCost > 0 ? ((wholesaleProfit / numCost) * 100).toFixed(1) : '0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'اسم المادة مطلوب';
    if (costPrice === '' || Number(costPrice) < 0) newErrors.costPrice = 'سعر الشراء / التكلفة مطلوب';
    if (retailPrice === '' || Number(retailPrice) < 0) newErrors.retailPrice = 'سعر بيع المفرد مطلوب';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim() || `${Date.now()}`,
      category: category.trim(),
      unit: unit.trim(),
      costPrice: Number(costPrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      wholesalePrice: wholesalePrice === '' ? (Number(retailPrice) || 0) : Number(wholesalePrice),
      stock: stock === '' ? 0 : Number(stock),
      piecesPerCarton: ppc,
      cartonCostPrice: cartonCostPrice === '' ? Math.round((Number(costPrice) || 0) * ppc) : Number(cartonCostPrice),
      cartonRetailPrice: cartonRetailPrice === '' ? Math.round((Number(retailPrice) || 0) * ppc) : Number(cartonRetailPrice),
      cartonWholesalePrice: cartonWholesalePrice === '' ? undefined : Number(cartonWholesalePrice),
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
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
                تحويل حسابي تلقائي ومتبادل بين سعر القطعة وسعر الكرتون
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanned Notification Banner */}
        {scannedNotification && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-pulse">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{scannedNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setScannedNotification(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

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
                placeholder="مثال: شفرة حلاقة، زيت، مسامير، سائل غسيل..."
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.name && (
                <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.name}</span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  الرمز أو الباركود
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  الماسح جاهز
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="1001"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-600 rounded transition cursor-pointer"
                  title="مسح الباركود عبر كاميرا الهاتف"
                >
                  <ScanLine className="w-4 h-4" />
                </button>
              </div>
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
                  className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700 cursor-pointer"
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
                الوحدة الأساسية
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
                  className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700 cursor-pointer"
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

          {/* Row 3: Carton Capacity Definition (سعة الكرتون) */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-amber-700" />
                <span>سعة الكرتون (كم قطعة يحتوي الكارتون الواحد؟)</span>
              </label>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                النسبة: 1 كرتون = {piecesPerCarton || 1} قطعة
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-36">
                <input
                  type="number"
                  min="1"
                  value={piecesPerCarton}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                    if (typeof val === 'number') {
                      handlePpcChange(val);
                    } else {
                      setPiecesPerCarton('');
                    }
                  }}
                  placeholder="12"
                  className="w-full pl-12 pr-3 py-1.5 text-sm font-black border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-mono"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-800 font-bold">
                  قطعة
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {[6, 12, 24, 30, 48].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePpcChange(preset)}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      piecesPerCarton === preset
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {preset} ق
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-amber-900/70">
              * يتم استخدام هذه السعة للتحويل الحسابي الفوري بين سعر الكرتون وسعر القطعة، وكذلك لخصم المخزون بدقة.
            </p>
          </div>

          {/* Row 4: Two-Way Synchronized Pricing (التحويل التلقائي بين سعر القطعة وسعر الكرتون) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>هيكل الأسعار (تحويل تلقائي بين سعر القطعة وسعر الكرتون)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يُحسب سعر القطعة تلقائياً عند إدخال سعر الكرتون، ويمكنك تعديل سعر القطعة بحرية دون تغيير سعر الكرتون
                </p>
              </div>

              {/* Mode indicator */}
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPricingBase('carton')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    pricingBase === 'carton' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>بالكرتون</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPricingBase('piece')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    pricingBase === 'piece' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>بالقطعة</span>
                </button>
              </div>
            </div>

            {/* Price Inputs List */}
            <div className="space-y-3.5">
              
              {/* 1. Cost Price (سعر الشراء / التكلفة) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>1. سعر الشراء / التكلفة</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (1 كرتون = {ppc} قطع)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                      سعر الكرتون الكامل:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={cartonCostPrice}
                        onChange={(e) => handleCartonCostChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-3 py-1.5 text-sm font-bold border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/20 font-mono text-left"
                        dir="ltr"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-800 font-bold">
                        {settings.currency}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                      سعر القطعة (يُحسب تلقائياً ويمكنك تعديله بحرية):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={costPrice}
                        onChange={(e) => handlePieceCostChange(e.target.value)}
                        placeholder="0.00"
                        className={`w-full pl-12 pr-3 py-1.5 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 font-mono text-left ${
                          errors.costPrice ? 'border-rose-400' : 'border-emerald-300'
                        }`}
                        dir="ltr"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-800 font-bold">
                        {settings.currency}
                      </span>
                    </div>
                  </div>
                </div>
                {errors.costPrice && (
                  <span className="text-[11px] text-rose-500 mt-1 block">{errors.costPrice}</span>
                )}
              </div>

              {/* 2. Retail Selling Price (سعر بيع المفرد) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>2. سعر بيع المفرد (تجزئة)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (1 كرتون = {ppc} قطع)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                      سعر بيع الكرتون (مفرد):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={cartonRetailPrice}
                        onChange={(e) => handleCartonRetailChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-3 py-1.5 text-sm font-bold border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/20 font-mono text-left"
                        dir="ltr"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-800 font-bold">
                        {settings.currency}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                      سعر بيع القطعة (مفرد - يُحسب تلقائياً ويمكن تعديله):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={retailPrice}
                        onChange={(e) => handlePieceRetailChange(e.target.value)}
                        placeholder="0.00"
                        className={`w-full pl-12 pr-3 py-1.5 text-sm font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 font-mono text-left ${
                          errors.retailPrice ? 'border-rose-400' : 'border-emerald-300'
                        }`}
                        dir="ltr"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-800 font-bold">
                        {settings.currency}
                      </span>
                    </div>
                  </div>
                </div>
                {errors.retailPrice && (
                  <span className="text-[11px] text-rose-500 mt-1 block">{errors.retailPrice}</span>
                )}
              </div>

              {/* 3. Wholesale Selling Price (سعر بيع الجملة) */}
              {settings.enableWholesale && (
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      <span>3. سعر بيع الجملة (اختياري)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (1 كرتون = {ppc} قطع)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                        سعر بيع الكرتون (جملة):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cartonWholesalePrice}
                          onChange={(e) => handleCartonWholesaleChange(e.target.value)}
                          placeholder={cartonRetailPrice ? String(cartonRetailPrice) : '0.00'}
                          className="w-full pl-12 pr-3 py-1.5 text-sm font-bold border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/20 font-mono text-left"
                          dir="ltr"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-blue-800 font-bold">
                          {settings.currency}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                        سعر بيع القطعة (جملة - يُحسب تلقائياً ويمكن تعديله):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={wholesalePrice}
                          onChange={(e) => handlePieceWholesaleChange(e.target.value)}
                          placeholder={retailPrice ? String(retailPrice) : '0.00'}
                          className="w-full pl-12 pr-3 py-1.5 text-sm font-bold border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/20 font-mono text-left"
                          dir="ltr"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-blue-800 font-bold">
                          {settings.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Profit Margin Indicator */}
            {numCost > 0 && numRetail > 0 && (
              <div className={`grid ${settings.enableWholesale ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2 border-t border-slate-200 text-xs`}>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600">صافي ربح القطعة (مفرد):</span>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-700">
                      +{retailProfit.toLocaleString()} {settings.currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      (كرتون: +{(retailProfit * ppc).toLocaleString()} {settings.currency})
                    </span>
                  </div>
                </div>

                {settings.enableWholesale && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">صافي ربح القطعة (جملة):</span>
                    <div className="text-right">
                      <span className="font-extrabold text-blue-700">
                        +{wholesaleProfit.toLocaleString()} {settings.currency}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        (كرتون: +{(wholesaleProfit * ppc).toLocaleString()} {settings.currency})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: Stock in Cartons & Pieces */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-emerald-700" />
                <span>رصيد المخزن الأولي (تحويل متبادل بين الكراتين والقطع)</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                ينقص الرصيد تلقائياً عند بيع الكراتين أو القطع
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Stock Cartons */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  الرصيد بعدد الكراتين:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={stockCartons}
                    onChange={(e) => handleStockCartonsChange(e.target.value)}
                    placeholder="5"
                    className="w-full pl-14 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                    كارتون
                  </span>
                </div>
              </div>

              {/* Stock Pieces */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  إجمالي الرصيد بالقطع (يُحسب تلقائياً):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => handleStockPiecesChange(e.target.value)}
                    placeholder="60"
                    className="w-full pl-12 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                    قطعة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>{productToEdit ? 'حفظ التعديلات' : 'إضافة المادة للمخزن'}</span>
            </button>
          </div>

        </form>

        {/* Camera Modal */}
        <CameraBarcodeScanner
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(scanned) => {
            setCode(scanned);
            setIsCameraOpen(false);
            playBarcodeBeep(true);
            setScannedNotification(`تم مسح الباركود بالكاميرا: ${scanned}`);
            setTimeout(() => setScannedNotification(null), 3000);
          }}
          title="مسح باركود المادة لحفظه"
        />

      </div>
    </div>
  );
};
