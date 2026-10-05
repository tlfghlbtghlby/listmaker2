import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product, SaleType, PriceType, InvoiceItem, Invoice } from '../types';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  UserCheck, 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Tag, 
  Clock, 
  Printer, 
  Settings,
  ArrowLeft,
  ArrowRight,
  ScanLine,
  Camera,
  X,
  Box,
  Pencil,
  Check,
  Edit3,
  UserPlus
} from 'lucide-react';
import { useBarcodeScanner, playBarcodeBeep } from '../utils/barcodeUtils';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { BarcodeTestModal } from './BarcodeTestModal';

interface POSViewProps {
  onInvoiceCreated: (invoice: Invoice, andPrint?: boolean) => void;
  onOpenNewProduct: (barcode?: string) => void;
  onEditProduct?: (product: Product) => void;
  onOpenSettings?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ 
  onInvoiceCreated, 
  onOpenNewProduct, 
  onEditProduct,
  onOpenSettings 
}) => {
  const { products, customers, createInvoice, addCustomer, updateSettings, formatMoney, settings } = useApp();

  // POS State
  const [saleType, setSaleType] = useState<SaleType>('direct');
  const [globalPriceType, setGlobalPriceType] = useState<PriceType>('retail');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => settings.defaultCategory || 'all');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  
  // Cart Items
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  
  // Customer info for sale
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  
  // Financial modifiers
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(() => {
    // Default due date: 15 days from now
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');

  // Inline micro-editing for carton/piece price (قلم صغير لتعديل سعر الكرتون/القطعة في القائمة)
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  // Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [scanBanner, setScanBanner] = useState<{ type: 'success' | 'warning'; message: string; barcode?: string } | null>(null);

  // Saved invoice notification banner (when saved without printing)
  const [savedNotification, setSavedNotification] = useState<{ invoiceNumber: string; total: number } | null>(null);

  // Quick Add Customer for Credit Sales
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('');
  const [quickCustomerNotes, setQuickCustomerNotes] = useState('');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    if (settings.defaultCategory && settings.defaultCategory !== 'all') {
      set.add(settings.defaultCategory);
    }
    return ['all', ...Array.from(set)];
  }, [products, settings.defaultCategory]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.code.toLowerCase().includes(q) ||
        prod.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Selected customer or matched existing customer in customers list
  const matchedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      return customers.find((c) => c.id === selectedCustomerId) || null;
    }
    const trimmed = customCustomerName.trim().toLowerCase();
    if (!trimmed) return null;
    return customers.find((c) => c.name.trim().toLowerCase() === trimmed) || null;
  }, [customers, selectedCustomerId, customCustomerName]);

  // Selected customer details (kept for backward compatibility with debt display)
  const selectedCustomer = matchedCustomer;

  // Handle Quick Add Credit Customer
  const handleQuickAddCreditCustomer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToAdd = customCustomerName.trim();
    if (!nameToAdd) {
      alert('يرجى إدخال اسم الزبون لإضافته');
      return;
    }
    const newCust = addCustomer({
      name: nameToAdd,
      phone: customerPhone.trim(),
      address: quickCustomerAddress.trim(),
      notes: quickCustomerNotes.trim()
    });
    setSelectedCustomerId(newCust.id);
    setCustomCustomerName(newCust.name);
    setCustomerPhone(newCust.phone);
    setIsQuickAddCustomerOpen(false);
    setQuickCustomerAddress('');
    setQuickCustomerNotes('');
  };

  // Update customer selection
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id) {
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        setCustomCustomerName(cust.name);
        setCustomerPhone(cust.phone);
      }
    } else {
      setCustomCustomerName('');
      setCustomerPhone('');
    }
  };

  // Add product to cart with chosen price type and unit type (piece or carton)
  const addToCartWithPrice = (
    product: Product,
    priceType: PriceType,
    unitType: 'piece' | 'carton' = 'piece'
  ) => {
    const ppc = product.piecesPerCarton && product.piecesPerCarton > 1 ? product.piecesPerCarton : 1;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);

      if (existingIndex > -1) {
        const updated = [...prev];
        const existingItem = updated[existingIndex];
        const itemPriceType = existingItem.priceType || priceType;
        const itemUnitType = existingItem.unitType || unitType;
        const isCarton = itemUnitType === 'carton';

        const basePiecePrice = itemPriceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        const cartonPrice = itemPriceType === 'wholesale'
          ? (product.cartonWholesalePrice || product.wholesalePrice * ppc)
          : (product.cartonRetailPrice || product.retailPrice * ppc);
        const unitPrice = isCarton ? cartonPrice : basePiecePrice;
        const newQty = existingItem.quantity + 1;
        const deducted = isCarton ? newQty * ppc : newQty;

        updated[existingIndex] = {
          ...existingItem,
          priceType: itemPriceType,
          unitType: itemUnitType,
          unitPrice: unitPrice,
          quantity: newQty,
          deductedPieces: deducted,
          total: newQty * unitPrice,
        };
        return updated;
      } else {
        const isCarton = unitType === 'carton';
        const basePiecePrice = priceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        const baseCostPrice = product.costPrice;
        const cartonPrice = priceType === 'wholesale'
          ? (product.cartonWholesalePrice || product.wholesalePrice * ppc)
          : (product.cartonRetailPrice || product.retailPrice * ppc);
        const cartonCost = product.cartonCostPrice || baseCostPrice * ppc;
        const unitPrice = isCarton ? cartonPrice : basePiecePrice;
        const costPrice = isCarton ? cartonCost : baseCostPrice;
        const deducted = isCarton ? ppc : 1;

        const newItem: InvoiceItem = {
          productId: product.id,
          productName: product.name,
          code: product.code,
          unit: product.unit,
          priceType: priceType,
          unitType: unitType,
          piecesPerCarton: ppc,
          deductedPieces: deducted,
          costPrice: costPrice,
          unitPrice: unitPrice,
          quantity: 1,
          total: unitPrice,
        };
        return [...prev, newItem];
      }
    });
  };

  const addToCart = (product: Product) => {
    addToCartWithPrice(product, globalPriceType, 'piece');
  };

  // Barcode scan handler: automatically called by USB/Bluetooth barcode scanner or Camera
  const handleBarcodeScanned = (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    // Search products by barcode / code or ID
    const matched = products.find(
      (p) => p.code.toLowerCase() === barcode.toLowerCase() || p.id === barcode
    );

    if (matched) {
      playBarcodeBeep(true);
      // Immediately added to cart at retail price (سعر المفرد) as requested by default
      addToCartWithPrice(matched, 'retail', 'piece');
      
      const currentItem = cartItems.find((i) => i.productId === matched.id);
      const newQty = (currentItem ? currentItem.quantity : 0) + 1;

      setScanBanner({
        type: 'success',
        message: `تم مسح: ${matched.name} (#${matched.code}) وأضيفت إلى القائمة بسعر المفرد (${formatMoney(matched.retailPrice)}) - الكمية: ${newQty}`,
      });
      setTimeout(() => setScanBanner(null), 3500);
    } else {
      playBarcodeBeep(false);
      setScanBanner({
        type: 'warning',
        message: `الرمز أو الباركود (${barcode}) غير مسجل في المخزون.`,
        barcode: barcode,
      });
    }
  };

  // Hardware Barcode Scanner listener
  useBarcodeScanner({
    isEnabled: !isCameraScannerOpen,
    onScan: handleBarcodeScanned,
  });

  // Update Item Quantity
  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const prod = products.find((p) => p.id === productId);
    const ppc = prod?.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 1;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const isCarton = item.unitType === 'carton';
          const deducted = isCarton ? newQty * ppc : newQty;
          return {
            ...item,
            quantity: newQty,
            deductedPieces: deducted,
            total: newQty * item.unitPrice,
          };
        }
        return item;
      })
    );
  };

  // Switch unit type (قطعة vs كرتون) for an individual item in cart
  const toggleItemUnitType = (productId: string, newUnitType: 'piece' | 'carton') => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const ppc = prod.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 1;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const isCarton = newUnitType === 'carton';
          const basePiecePrice = item.priceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
          const basePieceCost = prod.costPrice;

          const cartonPrice = item.priceType === 'wholesale'
            ? (prod.cartonWholesalePrice || prod.wholesalePrice * ppc)
            : (prod.cartonRetailPrice || prod.retailPrice * ppc);
          const cartonCost = prod.cartonCostPrice || basePieceCost * ppc;

          const newUnitPrice = isCarton ? cartonPrice : basePiecePrice;
          const newCostPrice = isCarton ? cartonCost : basePieceCost;
          const deducted = isCarton ? item.quantity * ppc : item.quantity;

          return {
            ...item,
            unitType: newUnitType,
            unitPrice: newUnitPrice,
            costPrice: newCostPrice,
            deductedPieces: deducted,
            total: item.quantity * newUnitPrice,
          };
        }
        return item;
      })
    );
  };

  // Switch price type for an individual item in cart (مفرد vs جملة)
  const toggleItemPriceType = (productId: string, newPriceType: PriceType) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const ppc = prod.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 1;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const isCarton = item.unitType === 'carton';
          const basePiecePrice = newPriceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
          const newUnitPrice = isCarton ? basePiecePrice * ppc : basePiecePrice;

          return {
            ...item,
            priceType: newPriceType,
            unitPrice: newUnitPrice,
            total: item.quantity * newUnitPrice,
          };
        }
        return item;
      })
    );
  };

  // Start micro-editing price
  const handleStartEditPrice = (item: InvoiceItem) => {
    setEditingPriceItemId(item.productId);
    setEditingPriceValue(String(item.unitPrice));
  };

  // Quick edit carton price specifically (if currently on piece, automatically activates carton)
  const handleEditCartonPrice = (item: InvoiceItem) => {
    const prod = products.find((p) => p.id === item.productId);
    const ppc = prod?.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 1;

    if (item.unitType !== 'carton') {
      const cartonPrice = item.priceType === 'wholesale'
        ? (prod?.cartonWholesalePrice || (prod?.wholesalePrice || item.unitPrice) * ppc)
        : (prod?.cartonRetailPrice || (prod?.retailPrice || item.unitPrice) * ppc);
      toggleItemUnitType(item.productId, 'carton');
      setEditingPriceItemId(item.productId);
      setEditingPriceValue(String(cartonPrice));
    } else {
      setEditingPriceItemId(item.productId);
      setEditingPriceValue(String(item.unitPrice));
    }
  };

  // Save customized unit/carton price
  const handleSaveCustomPrice = (productId: string) => {
    const val = parseFloat(editingPriceValue);
    if (!isNaN(val) && val >= 0) {
      setCartItems((prev) =>
        prev.map((item) => {
          if (item.productId === productId) {
            return {
              ...item,
              unitPrice: val,
              total: item.quantity * val,
            };
          }
          return item;
        })
      );
    }
    setEditingPriceItemId(null);
  };

  // Apply global price type to all current items
  const handleGlobalPriceTypeChange = (type: PriceType) => {
    setGlobalPriceType(type);
    setCartItems((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const ppc = prod.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 1;
        const isCarton = item.unitType === 'carton';
        const basePiecePrice = type === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
        const newUnitPrice = isCarton ? basePiecePrice * ppc : basePiecePrice;

        return {
          ...item,
          priceType: type,
          unitPrice: newUnitPrice,
          total: item.quantity * newUnitPrice,
        };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setNotes('');
  };

  // Math totals
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const totalCost = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  }, [cartItems]);

  const finalTotal = Math.max(0, subtotal - discount);
  const estimatedProfit = finalTotal - totalCost;

  // In direct sale, paid amount is full total. In credit sale, user sets downpayment
  const actualPaidAmount = saleType === 'direct' ? finalTotal : Math.min(paidAmount, finalTotal);
  const remainingDebt = Math.max(0, finalTotal - actualPaidAmount);
  const previousCustomerDebt = selectedCustomer ? selectedCustomer.totalDebt : 0;
  const newCustomerDebt = previousCustomerDebt + remainingDebt;

  // Handle Submit
  const handleSaveInvoice = (andPrint: boolean) => {
    if (cartItems.length === 0) {
      alert('الرجاء إضافة مادة واحدة على الأقل إلى القائمة');
      return;
    }

    if (saleType === 'credit') {
      const validCustomer = matchedCustomer || customers.find((c) => c.id === selectedCustomerId);
      if (!validCustomer) {
        alert(
          customCustomerName.trim()
            ? `عذراً، الزبون (${customCustomerName.trim()}) غير مسجل في قائمة زبائن الأجل المعتمدين!\nلا يمكن إتمام البيع بالأجل إلا للزبائن المضافين مسبقاً. يرجى النقر على زر "إضافة هذا الزبون" أولاً.`
            : 'في حالة البيع الآجل، يجب اختيار زبون مسجل مسبقاً أو إضافة زبون جديد إلى قائمة زبائن الأجل!'
        );
        if (customCustomerName.trim()) {
          setIsQuickAddCustomerOpen(true);
        }
        return;
      }
    }

    const effectiveCustomer = matchedCustomer || customers.find((c) => c.id === selectedCustomerId);

    const created = createInvoice({
      type: saleType,
      customerId: effectiveCustomer ? effectiveCustomer.id : undefined,
      customerName: effectiveCustomer ? effectiveCustomer.name : (customCustomerName.trim() || 'زبون نقدي مباشر'),
      customerPhone: effectiveCustomer?.phone || customerPhone.trim(),
      items: cartItems,
      discount: discount,
      paidAmount: actualPaidAmount,
      paymentDueDate: saleType === 'credit' ? dueDate : undefined,
      notes: notes.trim(),
    });

    // Clear cart
    clearCart();
    if (saleType === 'credit') {
      setSelectedCustomerId('');
      setCustomCustomerName('');
      setCustomerPhone('');
    }

    if (!andPrint) {
      setSavedNotification({
        invoiceNumber: created.invoiceNumber,
        total: created.total
      });
      setTimeout(() => setSavedNotification(null), 4000);
    }

    onInvoiceCreated(created, andPrint);
  };

  const isMobileMode = settings.deviceMode === 'mobile';

  return (
    <div className="flex flex-col gap-4">
      
      {/* Saved Invoice Success Notification Banner (when saving without printing) */}
      {savedNotification && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-md border border-emerald-500 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-100 shrink-0" />
            <span>
              تم حفظ القائمة رقم <strong className="font-mono text-emerald-100">#{savedNotification.invoiceNumber}</strong> بنجاح في السجل (المبلغ: {formatMoney(savedNotification.total)}) دون طباعة.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSavedNotification(null)}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 rounded-lg text-emerald-100 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Mobile Mode Switcher Tabs (Only visible when deviceMode is 'mobile') */}
      {isMobileMode && (
        <div className="flex items-center bg-slate-200/90 p-1 rounded-xl text-xs font-bold w-full shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mobileTab === 'products'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-slate-600" />
            <span>تصفح المواد والبحث</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
              mobileTab === 'cart'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>فاتورة البيع الحالية</span>
            {cartItems.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                mobileTab === 'cart' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
              }`}>
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Main Content Grid: Side-by-side on desktop (مستطيل وجانبي: المواد وبجانبها القائمة), tabbed on mobile */}
      <div className={isMobileMode ? 'flex flex-col gap-4' : 'grid grid-cols-12 gap-4 lg:gap-6'}>
        
        {/* Products Column (Right in RTL): Visible on Desktop OR when mobileTab === 'products' */}
        {(!isMobileMode || mobileTab === 'products') && (
          <div className={`${isMobileMode ? 'w-full' : 'col-span-12 md:col-span-7'} flex flex-col gap-4`}>
            
            {/* Scanned Feedback Banner */}
            {scanBanner && (
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-xs transition ${
                scanBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  {scanBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{scanBanner.message}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {scanBanner.type === 'warning' && scanBanner.barcode && (
                    <button
                      type="button"
                      onClick={() => {
                        const bc = scanBanner.barcode;
                        setScanBanner(null);
                        onOpenNewProduct(bc);
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                    >
                      إضافة كمادة جديدة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setScanBanner(null)}
                    className="p-1 hover:bg-black/10 rounded-md transition text-slate-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Search & Categories Box */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
              
              {/* Clean Search Input + Direct Quick Add Product Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-barcode-input="true"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = searchQuery.trim();
                        if (val) {
                          e.preventDefault();
                          handleBarcodeScanned(val);
                          setSearchQuery('');
                        }
                      }
                    }}
                    placeholder="ابحث باسم المادة أو الباركود أو الرمز..."
                    className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-slate-400 hover:text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer font-bold"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Camera Barcode Scanner Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                  title="مسح الباركود باستخدام كاميرا الهاتف أو الكمبيوتر"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">مسح بكاميرا</span>
                </button>

                {/* Test / Simulate Barcode Scanner Button */}
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                  title="فحص وتجربة الماسح الشريطي وعرض باركودات المواد"
                >
                  <ScanLine className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">تجربة الماسح</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenNewProduct()}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="إضافة مادة جديدة للمخزن مباشرة دون مغادرة الشاشة"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">مادة جديدة</span>
                </button>
              </div>

              {/* Hardware Barcode Scanner Status Indicator */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200/70 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer text-right"
                  title="انقر لفحص وتجربة الماسح أو عرض الباركودات للاختبار"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <ScanLine className="w-3 h-3 text-emerald-600" />
                  <span>ماسح الباركود متصل وجاهز (امسح أي مادة للإضافة بسعر المفرد تلقائياً)</span>
                  <span className="text-[10px] text-emerald-800 underline mr-1 font-bold">تجربة وفحص</span>
                </button>
                <span className="text-slate-400 hidden md:inline">
                  (يمكن تحويل السعر للجملة من الفاتورة)
                </span>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'جميع المواد' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products List - Horizontal Rectangular Layout */}
            <div className={`flex flex-col gap-2.5 ${isMobileMode ? 'max-h-[calc(100vh-250px)] pb-16' : 'max-h-[calc(100vh-270px)]'} overflow-y-auto pr-1`}>
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-6">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">لا توجد مواد تطابق البحث</p>
                  <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم بدقة</p>
                </div>
              ) : (
                filteredProducts.map((prod) => {
                  const isLowStock = prod.stock <= prod.minStock;
                  const isOutOfStock = prod.stock <= 0;

                  return (
                    <div
                      key={prod.id}
                      className={`bg-white rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition text-right group select-none relative ${
                        isOutOfStock
                          ? 'border-slate-200 opacity-60 bg-slate-50'
                          : 'border-slate-200 hover:border-emerald-500 hover:shadow-xs'
                      }`}
                    >
                      {/* Right side: Product Name, Code, Unit, Category & Stock */}
                      <div
                        onClick={() => !isOutOfStock && addToCart(prod)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                            #{prod.code}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {prod.category}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-700'
                                : isLowStock
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isOutOfStock ? 'نافد من المخزن' : `المتوفر: ${prod.stock} ${prod.unit}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug group-hover:text-emerald-700 transition">
                            {prod.name}
                          </h3>
                          {onEditProduct && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProduct(prod);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-emerald-800 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-md text-[11px] font-bold transition cursor-pointer shadow-2xs"
                              title={`تعديل المادة ومعرفة سعر التكلفة والجملة · سعر التكلفة: ${formatMoney(prod.costPrice)} · سعر الجملة: ${formatMoney(prod.wholesalePrice)}`}
                            >
                              <Edit3 className="w-3 h-3 text-emerald-600" />
                              <span>تعديل</span>
                              <span className="text-[10px] text-slate-500 font-semibold bg-white/90 px-1 rounded border border-slate-200">
                                التكلفة: {formatMoney(prod.costPrice)}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Left side: Clean selling prices and only two buttons (مفرد و جملة) */}
                      <div className="flex items-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        {/* Display Selling Prices: Retail and Wholesale */}
                        <div className="flex flex-col items-end gap-0.5 text-right">
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 font-mono">
                            <span className="text-[10px] text-slate-500 font-bold">مفرد:</span>
                            <span>{formatMoney(prod.retailPrice)}</span>
                          </div>
                          {settings.enableWholesale && (
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 font-mono">
                              <span className="text-[10px] text-slate-500 font-bold">جملة:</span>
                              <span>{formatMoney(prod.wholesalePrice)}</span>
                            </div>
                          )}
                        </div>

                        {/* Buttons: مفرد وجملة فقط كما طلب المستخدم */}
                        {!isOutOfStock ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCartWithPrice(prod, 'retail', 'piece');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                              title="إضافة بسعر المفرد"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>مفرد</span>
                            </button>

                            {settings.enableWholesale && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'wholesale', 'piece');
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                                title="إضافة بسعر الجملة"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>جملة</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            غير متوفر
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile Mode Floating Bottom Cart Bar */}
            {isMobileMode && cartItems.length > 0 && mobileTab === 'products' && (
              <div className="fixed bottom-3 left-3 right-3 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {cartItems.length}
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-300">مجموع القائمة:</div>
                    <div className="text-sm font-extrabold text-emerald-400 font-mono">{formatMoney(finalTotal)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('cart')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>عرض الفاتورة والمحاسبة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        )}

        {/* Left Column (in RTL): Invoice Builder & Cart: Visible on Desktop OR when mobileTab === 'cart' */}
        {(!isMobileMode || mobileTab === 'cart') && (
          <div className={`${isMobileMode ? 'w-full' : 'col-span-12 md:col-span-5'} flex flex-col gap-4`}>
            
            {/* Mobile Back Button to return to products catalog */}
            {isMobileMode && (
              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMobileTab('products')}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-600" />
                  <span>العودة لإضافة مواد أخرى</span>
                </button>
                <span className="text-xs font-bold text-slate-500">
                  عدد المواد في السلة: {cartItems.length}
                </span>
              </div>
            )}
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          
          {/* Header Controls: Direct / Credit Sale & Price mode */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col gap-3">
            
            {/* Sale Type Selector (بيع مباشر vs بيع آجل) */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">نوع القائمة:</span>
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setSaleType('direct')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                    saleType === 'direct'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>بيع مباشر (نقدي)</span>
                </button>
                <button
                  onClick={() => setSaleType('credit')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                    saleType === 'credit'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>بيع آجل (دين)</span>
                </button>
              </div>
            </div>

            {/* Price Type Switcher (تجزئة vs جملة) - يظهر فقط إذا كان البيع بالجملة مفعل في الإعدادات */}
            {settings.enableWholesale && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                <span className="text-xs font-bold text-slate-700">سعر البيع المطبق:</span>
                <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => handleGlobalPriceTypeChange('retail')}
                    className={`px-3 py-1 rounded-md transition ${
                      globalPriceType === 'retail'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    سعر البيع العادي (تجزئة)
                  </button>
                  <button
                    onClick={() => handleGlobalPriceTypeChange('wholesale')}
                    className={`px-3 py-1 rounded-md transition ${
                      globalPriceType === 'wholesale'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    سعر الجملة
                  </button>
                </div>
              </div>
            )}

            {/* Customer Details Box */}
            <div className={`pt-2.5 border-t border-slate-200/80 flex flex-col gap-2 rounded-xl p-2.5 transition ${
              saleType === 'credit' ? 'bg-amber-50/60 border border-amber-300 shadow-2xs' : ''
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className={`w-4 h-4 ${saleType === 'credit' ? 'text-amber-700' : 'text-slate-500'}`} />
                  <span>{saleType === 'credit' ? 'زبون البيع الآجل (إلزامي في قائمة الأجل):' : 'بيانات الزبون:'}</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsQuickAddCustomerOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title="إضافة زبون جديد إلى قائمة زبائن الأجل المعتمدين"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ إضافة زبون جديد</span>
                </button>
              </div>

              {/* Customer Selector Dropdown */}
              <div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className={`w-full text-xs bg-white border rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 ${
                    saleType === 'credit' && !matchedCustomer
                      ? 'border-amber-400 focus:ring-amber-500 font-bold bg-amber-50/20'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                >
                  <option value="">
                    {saleType === 'credit' 
                      ? '-- اختر من قائمة زبائن الأجل المعتمدين --' 
                      : '-- اختر زبون مسجل مسبقاً (اختياري) --'}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.totalDebt > 0 ? `(عليه دين: ${formatMoney(c.totalDebt)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manual Input with Auto-match */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={saleType === 'direct' ? 'اسم الزبون (اختياري)' : 'اسم الزبون للبيع الآجل *'}
                  value={customCustomerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCustomerName(val);
                    const found = customers.find(c => c.name.trim().toLowerCase() === val.trim().toLowerCase());
                    if (found) {
                      setSelectedCustomerId(found.id);
                      setCustomerPhone(found.phone);
                    } else if (selectedCustomerId) {
                      setSelectedCustomerId('');
                    }
                  }}
                  className={`text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 ${
                    saleType === 'credit' && !matchedCustomer
                      ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/40 font-semibold'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                />
                <input
                  type="text"
                  placeholder="رقم الهاتف (اختياري)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Customer Status & Add Customer Button - بنفس الحجم ونفس الترتيب تماماً */}
              {matchedCustomer ? (
                <div className="w-full bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 text-xs flex items-center justify-between text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>الزبون مسجل مسبقاً: <strong className="text-emerald-950 font-black">{matchedCustomer.name}</strong></span>
                  </div>
                  {matchedCustomer.totalDebt > 0 ? (
                    <span className="font-bold text-amber-800 text-[11px] bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md">
                      الدين السابق: {formatMoney(matchedCustomer.totalDebt)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      رصيد الحساب: صفر
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (customCustomerName.trim()) {
                      handleQuickAddCreditCustomer();
                    } else {
                      setIsQuickAddCustomerOpen(true);
                    }
                  }}
                  className="w-full bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 rounded-lg p-2.5 text-xs flex items-center justify-between text-amber-900 transition shadow-2xs cursor-pointer group"
                  title="إضافة هذا الزبون إلى قائمة زبائن الأجل المعتمدين"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 group-hover:scale-110 transition" />
                    <span>
                      الزبون غير مسجل مسبقًا إضافة {customCustomerName.trim() ? `(${customCustomerName.trim()})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-600 group-hover:bg-amber-700 text-white px-2.5 py-1 rounded-md text-xs font-black shadow-xs transition">
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>إضافة</span>
                  </div>
                </button>
              )}

              {/* Show Previous Debt notification if direct sale customer has existing debt */}
              {saleType === 'direct' && selectedCustomer && selectedCustomer.totalDebt > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs flex items-center justify-between text-amber-800">
                  <span>الدين السابق المستحق على هذا الزبون:</span>
                  <span className="font-extrabold text-amber-900">{formatMoney(selectedCustomer.totalDebt)}</span>
                </div>
              )}
            </div>

          </div>

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto p-3 max-h-[300px]">
            {cartItems.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-center">
                <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">القائمة فارغة حالياً</p>
                <p className="text-xs text-slate-400 mt-0.5">انقر على أي مادة من القائمة لإضافتها</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  const ppc = item.piecesPerCarton || prod?.piecesPerCarton || 1;
                  const isCarton = item.unitType === 'carton';
                  // Display type field as requested: e.g. "3 قطعة", "5 كارتون", "12 كارتون", "12 قطعة"
                  const typeLabel = `${item.quantity} ${isCarton ? 'كارتون' : 'قطعة'}`;

                  return (
                    <div
                      key={item.productId}
                      className={`rounded-xl p-3 flex flex-col gap-2.5 transition border ${
                        isCarton
                          ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                          : 'bg-white border-slate-200/90 shadow-2xs'
                      }`}
                    >
                      {/* Line 1: Item Name, Barcode, Type field & Remove */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded font-bold">
                              #{item.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900 leading-snug truncate">
                              {item.productName}
                            </span>
                          </div>

                          {/* Type display field: e.g. 3 قطعة، 5 كارتون، 12 قطعة، 12 كارتون */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md border ${
                              isCarton
                                ? 'bg-amber-100 text-amber-950 border-amber-300'
                                : 'bg-blue-50 text-blue-900 border-blue-200'
                            }`}>
                              <span className="text-slate-500 font-normal">النوع:</span>
                              <span>{typeLabel}</span>
                              {isCarton && ppc > 1 && (
                                <span className="text-[10px] text-amber-800 font-normal">
                                  ({item.quantity * ppc} ق)
                                </span>
                              )}
                            </span>

                            {/* Price Type Badge */}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              item.priceType === 'wholesale'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {item.priceType === 'wholesale' ? 'جملة' : 'مفرد'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="حذف المادة من القائمة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Line 2: Small rectangle unit selector (مستطيل صغير لتحديد قطعة أو كرتون) + Price toggle + Quantity */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
                        
                        {/* المستطيل الصغير لتحديد قطعة أو كرتون كما طلب المستخدم */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[11px] text-slate-500 font-bold ml-0.5">الوحدة:</span>
                          
                          {/* المستطيل الصغير */}
                          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => toggleItemUnitType(item.productId, 'piece')}
                              className={`px-2.5 py-1 rounded-md text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                !isCarton
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="البيع بالقطعة"
                            >
                              <span>قطعة</span>
                            </button>
                            <div className="inline-flex items-center">
                              <button
                                type="button"
                                onClick={() => toggleItemUnitType(item.productId, 'carton')}
                                className={`px-2 py-1 ${isCarton ? 'rounded-r-md' : 'rounded-md'} text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                  isCarton
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title={`البيع بالكرتون الكامل (سعة الكرتون: ${ppc} قطعة)`}
                              >
                                <Box className="w-3.5 h-3.5" />
                                <span>كرتون</span>
                              </button>

                              {/* قلم صغير جداً لتعديل سعر الكرتون مباشرة في المستطيل */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCartonPrice(item);
                                }}
                                className={`px-1.5 py-1 transition cursor-pointer flex items-center justify-center ${
                                  isCarton
                                    ? 'bg-amber-700 hover:bg-amber-800 text-amber-100 rounded-l-md border-r border-amber-500/50'
                                    : 'text-slate-400 hover:text-amber-700 hover:bg-slate-200 rounded-md mr-0.5'
                                }`}
                                title="قلم تعديل سعر الكرتون الكامل"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* زر التبديل بين المفرد والجملة */}
                          {settings.enableWholesale && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleItemPriceType(
                                  item.productId,
                                  item.priceType === 'retail' ? 'wholesale' : 'retail'
                                )
                              }
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ml-1 ${
                                item.priceType === 'wholesale'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}
                              title="التبديل بين سعر المفرد وسعر الجملة"
                            >
                              {item.priceType === 'wholesale' ? 'جملة' : 'مفرد'}
                            </button>
                          )}
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.productId, parseInt(e.target.value) || 1)
                            }
                            className="w-12 text-center text-xs font-black py-1 border-x border-slate-200 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>

                      {/* Line 3: Calculation & Total */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500 font-mono">
                            سعر {isCarton ? 'الكرتون' : 'القطعة'}:
                          </span>
                          
                          {editingPriceItemId === item.productId ? (
                            <div className="inline-flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                autoFocus
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCustomPrice(item.productId);
                                  } else if (e.key === 'Escape') {
                                    setEditingPriceItemId(null);
                                  }
                                }}
                                className="w-20 px-1 py-0.5 text-xs font-black text-slate-900 bg-white border border-amber-400 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-center"
                              />
                              <span className="text-[10px] text-slate-600 font-bold">{settings.currency}</span>
                              <button
                                type="button"
                                onClick={() => handleSaveCustomPrice(item.productId)}
                                className="p-1 text-emerald-700 hover:bg-emerald-100 rounded transition cursor-pointer"
                                title="تأكيد وحفظ السعر"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPriceItemId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                                title="إلغاء"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <span className="font-extrabold text-slate-800 font-mono text-xs">
                                {formatMoney(item.unitPrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEditPrice(item)}
                                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                                title={isCarton ? "تعديل سعر الكرتون الكامل بقلم سريع" : "تعديل السعر بقلم سريع"}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400">الإجمالي: </span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {formatMoney(item.total)}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Footer & Financial Calculations */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
            
            {/* Subtotal & Discount Row */}
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>المجموع الأولي:</span>
                <span className="font-bold text-slate-800">{formatMoney(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>الخصم (مبلغ نقدي):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={discount || ''}
                    placeholder="0"
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 text-left px-2 py-0.5 text-xs font-bold border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span>{settings.currency}</span>
                </div>
              </div>

              {/* Final Invoice Total */}
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>المبلغ المطلوب:</span>
                <span className="text-emerald-700">{formatMoney(finalTotal)}</span>
              </div>

              {/* Profit preview info */}
              <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded flex justify-between font-medium">
                <span>صافي الربح التقديري للقائمة:</span>
                <span className="font-bold">{formatMoney(estimatedProfit)}</span>
              </div>
            </div>

            {/* Credit Sale Specific Inputs: Downpayment & Remaining */}
            {saleType === 'credit' && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900">المبلغ المسدد نقداً الآن:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={finalTotal}
                      value={paidAmount || ''}
                      placeholder="0"
                      onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-28 text-left px-2 py-1 text-xs font-bold border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-amber-800 font-semibold">{settings.currency}</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-amber-950 pt-1 border-t border-amber-200/60">
                  <span>المبلغ الآجل المتبقي بالدين:</span>
                  <span className="text-rose-700">{formatMoney(remainingDebt)}</span>
                </div>

                {selectedCustomer && (
                  <div className="flex justify-between text-[11px] text-slate-700">
                    <span>إجمالي دين الزبون الجديد بعد هذه القائمة:</span>
                    <span className="font-extrabold text-slate-900">{formatMoney(newCustomerDebt)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-700" />
                    تاريخ استحقاق السداد:
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-xs px-2 py-0.5 border border-slate-300 rounded bg-white text-slate-700"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <input
              type="text"
              placeholder="ملاحظات على القائمة (تظهر في الوصل)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            {/* Warning if credit sale without pre-registered customer */}
            {saleType === 'credit' && !matchedCustomer && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>البيع بالأجل يتطلب اختيار أو إضافة الزبون أولاً</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={cartItems.length === 0 || (saleType === 'credit' && !matchedCustomer)}
                onClick={() => handleSaveInvoice(true)}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                title={saleType === 'credit' && !matchedCustomer ? 'يجب إضافة الزبون أولاً لإتمام البيع الآجل' : 'حفظ القائمة وإرسالها للطباعة فوراً'}
              >
                <Printer className="w-4 h-4" />
                <span>حفظ وطباعة القائمة</span>
              </button>

              <button
                disabled={cartItems.length === 0 || (saleType === 'credit' && !matchedCustomer)}
                onClick={() => handleSaveInvoice(false)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                title={saleType === 'credit' && !matchedCustomer ? 'يجب إضافة الزبون أولاً لإتمام البيع الآجل' : 'حفظ القائمة في السجل دون فتح نافذة الطباعة'}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ فقط</span>
              </button>
            </div>

            {cartItems.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-slate-500 hover:text-rose-600 text-center transition py-0.5 cursor-pointer"
              >
                تفريغ القائمة وإلغاء المواد
              </button>
            )}

          </div>

        </div>

      </div>
    )}

    {/* Camera Barcode Scanner Modal */}
    <CameraBarcodeScanner
      isOpen={isCameraScannerOpen}
      onClose={() => setIsCameraScannerOpen(false)}
      onScan={handleBarcodeScanned}
      title="مسح باركود المادة لإضافتها لقائمة البيع"
    />

    {/* Barcode Test & Simulation Modal */}
    <BarcodeTestModal
      isOpen={isTestModalOpen}
      onClose={() => setIsTestModalOpen(false)}
      products={products}
      onSimulateScan={(code) => handleBarcodeScanned(code)}
    />

    {/* Quick Add Customer Modal for Credit Sales */}
    {isQuickAddCustomerOpen && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">إضافة زبون جديد لقائمة زبائن الأجل</h3>
                <p className="text-[11px] text-slate-400">لتتمكن من البيع له بالأجل وتسجيل ديونه في سجله</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsQuickAddCustomerOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleQuickAddCreditCustomer} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الزبون <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customCustomerName}
                onChange={(e) => setCustomCustomerName(e.target.value)}
                placeholder="أدخل اسم الزبون الثلاثي أو التجاري"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="077XXXXXXXX"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان / المحل (اختياري)
              </label>
              <input
                type="text"
                value={quickCustomerAddress}
                onChange={(e) => setQuickCustomerAddress(e.target.value)}
                placeholder="المدينة، المنطقة، اسم السوق..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات (اختياري)
              </label>
              <input
                type="text"
                value={quickCustomerNotes}
                onChange={(e) => setQuickCustomerNotes(e.target.value)}
                placeholder="أي ملاحظات حول الزبون أو الاتفاق..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsQuickAddCustomerOpen(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>حفظ وإضافة الزبون للقائمة</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

  </div>

</div>
  );
};
