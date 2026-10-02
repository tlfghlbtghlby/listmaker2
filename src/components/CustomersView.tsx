import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, Invoice, PaymentRecord } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  DollarSign, 
  CreditCard, 
  Receipt, 
  Phone, 
  MapPin, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  X,
  Printer
} from 'lucide-react';

interface CustomersViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onViewInvoice }) => {
  const { 
    customers, 
    invoices, 
    payments, 
    addCustomer, 
    updateCustomer, 
    recordPayment, 
    formatMoney,
    settings 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  
  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recentReceipt, setRecentReceipt] = useState<PaymentRecord | null>(null);

  // Add Customer modal state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustInitialDebt, setNewCustInitialDebt] = useState<number | ''>('');
  const [newCustNotes, setNewCustNotes] = useState('');

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        cust.name.toLowerCase().includes(q) ||
        cust.phone.includes(q) ||
        (cust.address && cust.address.toLowerCase().includes(q));

      const matchDebt = !filterDebtOnly || cust.totalDebt > 0;
      return matchSearch && matchDebt;
    });
  }, [customers, searchQuery, filterDebtOnly]);

  // Overall Debt KPI stats
  const totalMarketDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);
  const indebtedCount = customers.filter((c) => c.totalDebt > 0).length;
  const zeroDebtCount = customers.filter((c) => c.totalDebt === 0).length;

  // Handle open statement
  const handleOpenStatement = (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsStatementOpen(true);
  };

  // Handle open payment modal
  const handleOpenPayment = (cust: Customer) => {
    setSelectedCustomer(cust);
    setPaymentAmount(cust.totalDebt > 0 ? cust.totalDebt : '');
    setPaymentNotes('');
    setRecentReceipt(null);
    setIsPaymentModalOpen(true);
  };

  // Submit payment
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount || Number(paymentAmount) <= 0) {
      alert('الرجاء إدخال مبلغ سداد صحيح أكبر من الصفر');
      return;
    }

    const receipt = recordPayment(
      selectedCustomer.id,
      Number(paymentAmount),
      paymentNotes.trim() || 'تسديد دفعة نقدية على الحساب'
    );

    setRecentReceipt(receipt);
    // Refresh selected customer state
    const updated = customers.find((c) => c.id === selectedCustomer.id);
    if (updated) setSelectedCustomer(updated);
  };

  // Submit new customer
  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert('اسم الزبون مطلوب');
      return;
    }

    addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      initialDebt: Number(newCustInitialDebt) || 0,
      notes: newCustNotes.trim(),
    });

    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustInitialDebt('');
    setNewCustNotes('');
    setIsAddCustomerOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Debt Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">إجمالي ديون البيع الآجل (في السوق)</div>
          <div className="text-2xl font-black text-amber-700">
            {formatMoney(totalMarketDebt)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">مبالغ مستحقة لدى الزبائن</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">الزبائن الذين عليهم ذمم ومبالغ آجلة</div>
          <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
            <span>{indebtedCount} زبون</span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
              ذمم نشطة
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">من أصل {customers.length} زبون مسجل</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">زبائن رصيدهم خالص (0 دين)</div>
          <div className="text-2xl font-black text-emerald-700">
            {zeroDebtCount} زبون
          </div>
          <div className="text-[11px] text-slate-400 mt-1">سددوا كامل حساباتهم</div>
        </div>

      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الزبون، رقم الهاتف، أو العنوان..."
            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterDebtOnly(!filterDebtOnly)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
              filterDebtOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {filterDebtOnly ? 'عرض المدينين فقط ✓' : 'تصفية: أصحاب الديون فقط'}
          </button>

          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة زبون جديد</span>
          </button>
        </div>

      </div>

      {/* Customers List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">اسم الزبون / العميل</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">العنوان</th>
                <th className="py-3 px-4 text-amber-900">إجمالي الدين الحالي</th>
                <th className="py-3 px-4">حالة الحساب</th>
                <th className="py-3 px-4 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا يوجد زبائن مطابقين</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const hasDebt = cust.totalDebt > 0;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{cust.name}</div>
                        {cust.notes && (
                          <div className="text-[11px] text-slate-400 font-normal">{cust.notes}</div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {cust.phone || '-'}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {cust.address || '-'}
                      </td>

                      {/* Debt Amount */}
                      <td className="py-3 px-4 font-extrabold text-base">
                        <span className={hasDebt ? 'text-amber-800' : 'text-slate-400'}>
                          {formatMoney(cust.totalDebt)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {hasDebt ? (
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                            عليه دين مستحق
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            حساب خالص
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Record Payment Button */}
                          <button
                            onClick={() => handleOpenPayment(cust)}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 flex items-center gap-1 transition"
                            title="تسجيل دفعة سداد دين من الزبون"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>سداد دين</span>
                          </button>

                          {/* Statement Button */}
                          <button
                            onClick={() => handleOpenStatement(cust)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1 transition"
                            title="كشف حساب تفصيلي للزبون"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>كشف حساب</span>
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

      {/* Modal 1: Customer Account Statement (كشف الحساب التفصيلي) */}
      {isStatementOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  كشف حساب الزبون: {selectedCustomer.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  {selectedCustomer.phone && <span>الهاتف: {selectedCustomer.phone}</span>}
                  {selectedCustomer.address && <span>العنوان: {selectedCustomer.address}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 text-right">
                  <div className="text-[10px] text-amber-900 font-bold">الدين الحالي المستحق</div>
                  <div className="font-black text-amber-950 text-sm">
                    {formatMoney(selectedCustomer.totalDebt)}
                  </div>
                </div>

                <button
                  onClick={() => setIsStatementOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Invoices by this customer */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  قوائم الشراء والفواتير السابقة:
                </h4>
                {invoices.filter((i) => i.customerId === selectedCustomer.id || i.customerName === selectedCustomer.name).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">
                    لا توجد فواتير مسجلة باسم هذا الزبون
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="py-2 px-3">رقم القائمة</th>
                          <th className="py-2 px-3">التاريخ</th>
                          <th className="py-2 px-3">نوع البيع</th>
                          <th className="py-2 px-3">الإجمالي</th>
                          <th className="py-2 px-3">المدفوع</th>
                          <th className="py-2 px-3">المتبقي (دين)</th>
                          <th className="py-2 px-3 text-center">عرض</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoices
                          .filter((i) => i.customerId === selectedCustomer.id || i.customerName === selectedCustomer.name)
                          .map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold">{inv.invoiceNumber}</td>
                              <td className="py-2 px-3 text-slate-500">
                                {new Date(inv.date).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="py-2 px-3">
                                {inv.type === 'direct' ? 'مباشر (نقدي)' : 'آجل (دين)'}
                              </td>
                              <td className="py-2 px-3 font-bold">{formatMoney(inv.total)}</td>
                              <td className="py-2 px-3 text-emerald-700 font-bold">
                                {formatMoney(inv.paidAmount)}
                              </td>
                              <td className="py-2 px-3 font-bold text-amber-800">
                                {formatMoney(inv.remainingAmount)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setIsStatementOpen(false);
                                    onViewInvoice(inv);
                                  }}
                                  className="text-emerald-600 hover:underline font-bold"
                                >
                                  معاينة
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payments by this customer */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  سجل سندات تسديد الديون (الدفعات):
                </h4>
                {payments.filter((p) => p.customerId === selectedCustomer.id).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">
                    لم يتم تسجيل أي سندات تسديد لهذا الزبون بعد
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="py-2 px-3">رقم السند</th>
                          <th className="py-2 px-3">التاريخ والوقت</th>
                          <th className="py-2 px-3">المبلغ المسدد</th>
                          <th className="py-2 px-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {payments
                          .filter((p) => p.customerId === selectedCustomer.id)
                          .map((pay) => (
                            <tr key={pay.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-blue-800">
                                {pay.receiptNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {new Date(pay.date).toLocaleString('ar-EG')}
                              </td>
                              <td className="py-2 px-3 font-black text-emerald-700 text-sm">
                                {formatMoney(pay.amount)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{pay.notes || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsStatementOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition"
              >
                إغلاق الكشف
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Record Payment / Debt Settlement (تسجيل سند قبض وسداد دين) */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">تسجيل سند تسديد دين</h3>
                <p className="text-xs text-slate-500">الزبون: {selectedCustomer.name}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recentReceipt ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-900">تم تسجيل السداد بنجاح!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    سند قبض رقم: <strong className="font-mono text-slate-800">{recentReceipt.receiptNumber}</strong>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 text-right">
                  <div className="flex justify-between">
                    <span>المبلغ المسدد:</span>
                    <strong className="text-emerald-700 font-bold">{formatMoney(recentReceipt.amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>المتبقي في ذمة الزبون الآن:</span>
                    <strong className="text-amber-800 font-bold">{formatMoney(selectedCustomer.totalDebt)}</strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة وصل القبض</span>
                  </button>
                  <button
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                  >
                    تم
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4">
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex justify-between items-center text-amber-900">
                  <span>الدين الحالي المستحق:</span>
                  <span className="font-black text-sm">{formatMoney(selectedCustomer.totalDebt)}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ المسدد نقداً <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={paymentAmount}
                      onChange={(e) =>
                        setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      autoFocus
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {settings.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات سند القبض
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="مثال: تسديد دفعة نقدية، حوالة، شيك..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                  >
                    تأكيد السداد وتخفيض الدين
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* Modal 3: Add New Customer */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">إضافة زبون جديد</h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون / الشركة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: علي محمد، مكتب السلام للمقاولات..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  العنوان / المنطقة
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="مثال: بغداد - المنصور"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رصيد دين سابق (إن وجد)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCustInitialDebt}
                  onChange={(e) =>
                    setNewCustInitialDebt(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  rows={2}
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="ملاحظات حول سداد العميل وتعامله..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                >
                  حفظ الزبون
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
