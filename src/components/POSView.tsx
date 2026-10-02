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
  ArrowRight
} from 'lucide-react';

interface POSViewProps {
  onInvoiceCreated: (invoice: Invoice) => void;
  onOpenNewProduct: () => void;
  onOpenSettings?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ onInvoiceCreated, onOpenNewProduct, onOpenSettings }) => {
  const { products, customers, createInvoice, updateSettings, formatMoney, settings } = useApp();

  // POS State
  const [saleType, setSaleType] = useState<SaleType>('direct');
  const [globalPriceType, setGlobalPriceType] = useState<PriceType>('retail');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

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

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

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

  // Add product to cart with chosen price type
  const addToCartWithPrice = (product: Product, priceType: PriceType) => {
    const existingIndex = cartItems.findIndex((item) => item.productId === product.id);
    const unitPrice = priceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;

    if (existingIndex > -1) {
      const updated = [...cartItems];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex] = {
        ...updated[existingIndex],
        priceType: priceType,
        unitPrice: unitPrice,
        quantity: newQty,
        total: newQty * unitPrice,
      };
      setCartItems(updated);
    } else {
      const newItem: InvoiceItem = {
        productId: product.id,
        productName: product.name,
        code: product.code,
        unit: product.unit,
        priceType: priceType,
        costPrice: product.costPrice,
        unitPrice: unitPrice,
        quantity: 1,
        total: unitPrice,
      };
      setCartItems((prev) => [...prev, newItem]);
    }
  };

  const addToCart = (product: Product) => {
    addToCartWithPrice(product, globalPriceType);
  };

  // Update Item Quantity
  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.unitPrice,
          };
        }
        return item;
      })
    );
  };

  // Switch price type for an individual item in cart
  const toggleItemPriceType = (productId: string, newPriceType: PriceType) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const newUnitPrice = newPriceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
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

  // Apply global price type to all current items
  const handleGlobalPriceTypeChange = (type: PriceType) => {
    setGlobalPriceType(type);
    setCartItems((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const newUnitPrice = type === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
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

    if (saleType === 'credit' && !customCustomerName.trim()) {
      alert('في حالة البيع الآجل، يجب تحديد أو إدخال اسم العميل لتسجيل الحساب عليه!');
      return;
    }

    const created = createInvoice({
      type: saleType,
      customerId: selectedCustomerId || undefined,
      customerName: customCustomerName.trim() || (saleType === 'direct' ? 'زبون نقدي مباشر' : 'عميل غير مسجل'),
      customerPhone: customerPhone.trim(),
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

    onInvoiceCreated(created);
  };

  const isMobileMode = settings.deviceMode === 'mobile';

  return (
    <div className="flex flex-col gap-4">
      
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
            
            {/* Search & Categories Box */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
              
              {/* Clean Search Input + Direct Quick Add Product Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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

                <button
                  type="button"
                  onClick={onOpenNewProduct}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="إضافة مادة جديدة للمخزن مباشرة دون مغادرة الشاشة"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">مادة جديدة</span>
                </button>
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

                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug group-hover:text-emerald-700 transition truncate">
                          {prod.name}
                        </h3>
                      </div>

                      {/* Left side: Prices shown */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        
                        {/* 1. Wholesale Cost Price Box - ALWAYS VISIBLE (سعر تكلفة الجملة يظل ظاهراً دائماً حتى في وضع الإخفاء) */}
                        <div className="bg-slate-100 border border-slate-300/80 rounded-lg px-2.5 py-1 text-right min-w-[95px]">
                          <div className="text-[10px] text-slate-600 font-bold">
                            سعر تكلفة الجملة:
                          </div>
                          <div className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                            {formatMoney(prod.costPrice)}
                          </div>
                        </div>

                        {/* 2. Wholesale Selling Price Box - VISIBLE ONLY IF WHOLESALE IS ENABLED (سعر بيع الجملة يختفي عند الإخفاء) */}
                        {settings.enableWholesale && (
                          <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg px-2.5 py-1 text-right min-w-[95px]">
                            <div className="text-[10px] text-amber-800 font-bold">
                              سعر بيع الجملة:
                            </div>
                            <div className="text-xs sm:text-sm font-black text-amber-950 font-mono">
                              {formatMoney(prod.wholesalePrice)}
                            </div>
                          </div>
                        )}

                        {/* 3. Retail Selling Price Box - ALWAYS VISIBLE (سعر بيع المفرد يظل ظاهراً دائماً) */}
                        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-lg px-3 py-1.5 text-right min-w-[105px]">
                          <div className="text-[10px] text-emerald-800 font-bold">
                            {settings.enableWholesale ? 'سعر بيع المفرد:' : 'سعر البيع:'}
                          </div>
                          <div className="text-xs sm:text-base font-black text-emerald-950 font-mono">
                            {formatMoney(prod.retailPrice)}
                          </div>
                        </div>

                        {/* Direct Quick Add Action Buttons */}
                        {!isOutOfStock ? (
                          <div className="flex items-center gap-1.5">
                            {settings.enableWholesale ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCartWithPrice(prod, 'retail');
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="إضافة بسعر البيع المفرد"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>مفرد</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCartWithPrice(prod, 'wholesale');
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="إضافة بسعر بيع الجملة"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>جملة</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'retail');
                                }}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                                title="إضافة المادة للقائمة بسعر المفرد"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة للقائمة</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">
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
            <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  بيانات الزبون:
                </span>
                {customers.length > 0 && (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- اختر من قائمة الزبائن --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.totalDebt > 0 ? `(عليه دين: ${formatMoney(c.totalDebt)})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={saleType === 'direct' ? 'اسم الزبون (اختياري)' : 'اسم الزبون (مطلوب للآجل)'}
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  className={`text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 ${
                    saleType === 'credit' && !customCustomerName
                      ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/30'
                      : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                />
                <input
                  type="text"
                  placeholder="رقم الهاتف (اختياري)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Show Previous Debt notification if customer has existing debt */}
              {selectedCustomer && selectedCustomer.totalDebt > 0 && (
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
                  const itemProfit = (item.unitPrice - item.costPrice) * item.quantity;
                  return (
                    <div
                      key={item.productId}
                      className="bg-slate-50 border border-slate-200/90 rounded-lg p-2.5 flex flex-col gap-2"
                    >
                      {/* Line 1: Item Name, Price selector, remove */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900 leading-snug">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>الوحدة: {item.unit}</span>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">
                              تكلفة الجملة: {formatMoney(item.costPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Price Type button - only shown if wholesale mode is enabled */}
                        <div className="flex items-center gap-1">
                          {settings.enableWholesale && (
                            <button
                              onClick={() =>
                                toggleItemPriceType(
                                  item.productId,
                                  item.priceType === 'retail' ? 'wholesale' : 'retail'
                                )
                              }
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition ${
                                item.priceType === 'wholesale'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-slate-200 text-slate-800 border-slate-300'
                              }`}
                              title="انقر للتبديل بين سعر التجزئة وسعر الجملة لهذه المادة"
                            >
                              {item.priceType === 'wholesale' ? 'سعر جملة' : 'سعر تجزئة'}
                            </button>
                          )}

                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="حذف المادة من القائمة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Line 2: Quantity buttons, Unit price, Total */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        {/* Quantity Counter */}
                        <div className="flex items-center bg-white border border-slate-300 rounded-md overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.productId, parseInt(e.target.value) || 1)
                            }
                            className="w-12 text-center text-xs font-bold py-0.5 border-x border-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price calculation */}
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500">
                            {formatMoney(item.unitPrice)} × {item.quantity} =
                          </span>
                          <span className="font-extrabold text-slate-900 mr-1.5">
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

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={cartItems.length === 0}
                onClick={() => handleSaveInvoice(true)}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>حفظ وطباعة القائمة</span>
              </button>

              <button
                disabled={cartItems.length === 0}
                onClick={() => handleSaveInvoice(false)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ فقط</span>
              </button>
            </div>

            {cartItems.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-slate-500 hover:text-rose-600 text-center transition py-0.5"
              >
                تفريغ القائمة وإلغاء المواد
              </button>
            )}

          </div>

        </div>

      </div>
    )}

  </div>

</div>
  );
};
