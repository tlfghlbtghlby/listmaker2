import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice } from '../types';
import { 
  X, 
  Printer, 
  Share2, 
  Check, 
  FileText, 
  Receipt,
  FileSpreadsheet,
  Wifi,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download
} from 'lucide-react';
import { 
  printInvoiceViaIframe, 
  printViaWebBluetooth, 
  isWebBluetoothAllowed, 
  downloadInvoicePDF,
  printInvoiceDirectly,
  applyPrintPageDimensions,
  removePrintPageDimensions
} from '../utils/printerUtils';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  autoPrint?: boolean;
}

type PrintFormat = 'a4' | 'a5' | 'thermal';

// Beautiful symmetrical 20-point starburst commercial seal
const StarburstSeal: React.FC<{ text: string }> = ({ text }) => {
  // Pre-calculated 20-pointed symmetrical star within 0-100 coordinate space
  const points = "50,4 58,18 73,11 75,27 91,27 86,43 98,54 87,66 92,82 76,82 73,98 58,91 50,104 42,91 27,98 24,82 8,82 13,66 2,54 14,43 9,27 25,27 27,11 42,18";

  return (
    <div className="relative flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 select-none shrink-0">
      <svg viewBox="0 0 100 108" className="w-full h-full fill-none stroke-black stroke-[2.2]">
        <polygon points={points} />
      </svg>
      <span className="absolute font-black text-[11px] sm:text-xs text-black whitespace-nowrap leading-none select-none text-center px-1">
        {text}
      </span>
    </div>
  );
};

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoice, onClose, autoPrint = false }) => {
  const { settings } = useApp();
  const [printLayout, setPrintLayout] = useState<PrintFormat>(
    settings.printFormat === 'thermal' ? 'thermal' : 'a4'
  );
  const [copied, setCopied] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  /**
   * وظيفة داخل InvoicePrintModal تضمن تهيئة الورقة وهوامش الطباعة (Print to PDF / Save as PDF)
   * عبر التأكد من تطبيق الهوامش والقياسات المحددة بدقة وفقاً للتنسيق (A4 أو A5 أو وصل حراري 80mm)
   * بما يضمن ظهور القائمة وحفظها كـ PDF بدون أي اقتطاع أو هوامش بيضاء غير مرغوبة.
   */
  const setupPrintPaperDimensions = (layout: PrintFormat) => {
    applyPrintPageDimensions(layout);
  };

  // Sync body class and exact page margins for browser Print & Print to PDF
  useEffect(() => {
    document.body.classList.remove('print-thermal', 'print-a5');
    if (printLayout === 'thermal') {
      document.body.classList.add('print-thermal');
    } else if (printLayout === 'a5') {
      document.body.classList.add('print-a5');
    }

    // تهيئة الورقة وهوامش الطباعة فورياً في رأس الصفحة
    setupPrintPaperDimensions(printLayout);

    return () => {
      document.body.classList.remove('print-thermal', 'print-a5');
      removePrintPageDimensions();
    };
  }, [printLayout]);

  // Auto print trigger if requested from POS ("حفظ وطباعة")
  useEffect(() => {
    if (autoPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, invoice?.id]);

  if (!invoice) return null;

  const dateObj = new Date(invoice.date);
  
  // Day name in Arabic
  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = arabicDays[dateObj.getDay()];

  // Formatted date string YYYY/MM/DD
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateFormatted = `${year}/${month}/${day}`;

  // Formatted time string YYYY/MM/DD HH:mm:ss
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const fullDateTime = `${dateFormatted} ${hours}:${minutes}:${seconds}`;

  const handlePrint = async () => {
    // التأكد من تهيئة الورقة وتطبيق الهوامش والقياسات بدقة قبل استدعاء أمر الطباعة / الحفظ كـ PDF
    setupPrintPaperDimensions(printLayout);

    const title = `قائمة_${invoice.invoiceNumber}_${invoice.customerName || 'عميل'}`;
    setPrintFeedback({ type: 'info', message: 'جاري فتح أمر الطباعة / الحفظ كـ PDF عبر المتصفح...' });
    const ok = await printInvoiceDirectly('printable-invoice', title, printLayout);
    if (ok) {
      setPrintFeedback({ type: 'success', message: 'تم فتح أمر الطباعة بنجاح (يمكنك اختيار حفظ كـ PDF أيضاً).' });
      setTimeout(() => setPrintFeedback(null), 3500);
    } else {
      setPrintFeedback({ 
        type: 'error', 
        message: 'تعذر فتح نافذة الطباعة التلقائية. يمكنك الضغط على "حفظ / تحميل PDF" لتنزيل القائمة وحفظها أو طباعتها.' 
      });
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setPrintFeedback({ type: 'info', message: 'جاري إنشاء ملف PDF وتجهيزه للحفظ والتنزيل المباشر...' });
    const safeName = (invoice.customerName || 'عميل').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `قائمة_${invoice.invoiceNumber}_${safeName}`;
    const ok = await downloadInvoicePDF('printable-invoice', filename, printLayout);
    setIsGeneratingPDF(false);

    if (ok) {
      setPrintFeedback({ type: 'success', message: 'تم حفظ وتنزيل ملف الـ PDF بنجاح على جهازك!' });
      setTimeout(() => setPrintFeedback(null), 3500);
    } else {
      setPrintFeedback({ 
        type: 'error', 
        message: 'تعذر حفظ ملف الـ PDF تلقائياً. يمكنك استخدام زر "طباعة القائمة" واختيار الوجهة "حفظ كـ PDF".' 
      });
    }
  };

  const handleBluetoothPrint = async () => {
    // Set format to thermal roll (80mm)
    setPrintLayout('thermal');

    if (!isWebBluetoothAllowed()) {
      setPrintFeedback({
        type: 'info',
        message: 'تم تجهيز القائمة كوصل كاشير (80mm) لطباعتها عبر طابعة البلوتوث المقترنة بالنظام. جاري فتح أمر الطباعة...'
      });
      setTimeout(() => {
        handlePrint();
      }, 400);
      return;
    }

    setIsBluetoothPrinting(true);
    setPrintFeedback({ type: 'info', message: 'جاري البحث عن طابعة البلوتوث اللاسلكية والاتصال بها...' });
    const res = await printViaWebBluetooth(invoice, settings);
    setIsBluetoothPrinting(false);

    if (res.success) {
      setPrintFeedback({ type: 'success', message: res.message });
      setTimeout(() => setPrintFeedback(null), 4000);
    } else if (res.isPermissionsPolicyBlocked) {
      setPrintFeedback({
        type: 'info',
        message: 'تم تحويل التنسيق إلى وصل كاشير (80mm). جاري فتح نافذة الطباعة لاختيار طابعة البلوتوث...'
      });
      setTimeout(() => {
        handlePrint();
      }, 400);
    } else if (res.isCancelled) {
      setPrintFeedback({ type: 'info', message: res.message });
      setTimeout(() => setPrintFeedback(null), 2500);
    } else {
      setPrintFeedback({ type: 'error', message: res.message });
    }
  };

  const handleCopyText = () => {
    let text = `📋 *${settings.storeName || 'قائمة بيع'}*\n`;
    text += `رقم القائمة: ${invoice.invoiceNumber}\n`;
    text += `التاريخ: ${dayName} ${dateFormatted}\n`;
    text += `حضرة السيد: ${invoice.customerName || 'زبون نقدي مباشر'}\n`;
    text += `---------------------------------\n`;
    invoice.items.forEach((item, index) => {
      const qtyStr = Number.isInteger(item.quantity) ? item.quantity.toString() : item.quantity.toFixed(2);
      text += `${index + 1}. ${item.productName} - عدد (${qtyStr} ${item.unit || 'قطعة'}) × ${item.unitPrice.toLocaleString()} = ${item.total.toLocaleString()} ${settings.currency}\n`;
    });
    text += `---------------------------------\n`;
    if (invoice.discount > 0) {
      text += `المجموع قبل الخصم: ${invoice.subtotal.toLocaleString()} ${settings.currency}\n`;
      text += `الخصم: ${invoice.discount.toLocaleString()} ${settings.currency}\n`;
    }
    text += `صافي القائمة: ${invoice.total.toLocaleString()} ${settings.currency}\n`;
    if (invoice.previousDebt > 0) {
      text += `الديون السابقة: ${invoice.previousDebt.toLocaleString()} ${settings.currency}\n`;
      text += `المجموع الكلي: ${(invoice.total + invoice.previousDebt).toLocaleString()} ${settings.currency}\n`;
    }
    text += `الواصل (التسديد): ${invoice.paidAmount.toLocaleString()} ${settings.currency}\n`;
    text += `المتبقي (الديون): ${(invoice.total + invoice.previousDebt - invoice.paidAmount).toLocaleString()} ${settings.currency}\n`;
    if (settings.phone || settings.address) {
      text += `\n${[settings.address, settings.phone].filter(Boolean).join(' - ')}`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculations for summary table
  const subtotal = invoice.subtotal || invoice.total;
  const discount = invoice.discount || 0;
  const invoiceTotal = invoice.total;
  const previousDebt = invoice.previousDebt || 0;
  const grandTotal = invoiceTotal + previousDebt;
  const paid = invoice.paidAmount;
  const totalRemainingDebt = Math.max(0, grandTotal - paid);

  // Currency label
  const currencyLabel = settings.currency || 'دينار';

  // Helper to format quantity cleanly without ugly .00
  const formatQty = (qty: number) => {
    if (qty === undefined || qty === null) return '';
    return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print-modal-overlay">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden print-modal-container">
        
        {/* Top Controls Bar (Hidden in Print) */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">تنسيق الطباعة:</span>
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintLayout('a4')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  printLayout === 'a4'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>ورقة كاملة (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintLayout('a5')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  printLayout === 'a5'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>نصف ورقة (A5)</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintLayout('thermal')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  printLayout === 'thermal'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>وصل كاشير (80mm)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-black text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="طباعة القائمة أو الحفظ كـ PDF عبر المتصفح (مهيأة بالهوامش والقياسات المحددة تلقائياً)"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة القائمة 🖨️</span>
            </button>

            {/* Direct PDF Download / Save button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 disabled:opacity-50 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              title="حفظ وتنزيل القائمة كملف PDF مباشر على جهازك أو هاتفك"
            >
              {isGeneratingPDF ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <Download className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />}
              <span>حفظ / تحميل PDF 📥</span>
            </button>

            {/* Bluetooth ESC/POS button */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={isBluetoothPrinting}
              className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg border border-blue-200 flex items-center gap-1.5 transition cursor-pointer"
              title="طباعة مباشرة لطابعات البلوتوث اللاسلكية الحرارية (ESC/POS)"
            >
              {isBluetoothPrinting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-blue-600" />}
              <span>طابعة بلوتوث 📶</span>
            </button>

            {/* WhatsApp Share / Copy text button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 flex items-center gap-1 transition cursor-pointer"
              title="نسخ ملخص القائمة لمشاركتها عبر الواتساب"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ!' : 'واتساب'}</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer mr-1"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Feedback Banner */}
        {printFeedback && (
          <div className={`p-2.5 px-4 text-xs font-bold flex items-center justify-between no-print ${
            printFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
              : printFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
              : 'bg-blue-50 text-blue-800 border-b border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {printFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {printFeedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              {printFeedback.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
              <span>{printFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintFeedback(null)}
              className="text-[11px] underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Invoice Viewer and Printable Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70 flex justify-center print-modal-body">
          
          <div
            id="printable-invoice"
            className={`bg-white shadow-lg text-black mx-auto ${
              printLayout === 'a4'
                ? 'w-full max-w-[820px] p-5 sm:p-8 rounded-lg border border-slate-400 font-sans'
                : printLayout === 'a5'
                ? 'w-full max-w-[580px] p-4 sm:p-6 rounded-lg border border-slate-400 font-sans text-xs'
                : 'w-[320px] p-4 rounded-lg border border-slate-400 font-mono text-xs'
            }`}
          >

            {/* A4 and A5 Standard Iraqi Wholesale/Retail Invoice */}
            {printLayout === 'a4' || printLayout === 'a5' ? (
              <div className={`space-y-3 text-black leading-tight ${printLayout === 'a5' ? 'text-xs' : ''}`}>
                
                {/* 1. Header Box with Corner Seals */}
                <div className="border border-black rounded-md p-2.5 sm:p-3 relative flex flex-col items-center justify-center text-center print-keep-together">
                  
                  {/* Right Seal: جملة if enabled, or تجزئة */}
                  <div className="absolute right-2 sm:right-3 top-2">
                    <StarburstSeal text={settings.enableWholesale ? "جملة" : "تجزئة"} />
                  </div>

                  {/* Left Seal: مفرد */}
                  <div className="absolute left-2 sm:left-3 top-2">
                    <StarburstSeal text="مفرد" />
                  </div>

                  {/* Center Store Title */}
                  <h1 className={`${printLayout === 'a5' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-black tracking-wide text-black px-16`}>
                    {settings.storeName || 'قائمة مبيعات'}
                  </h1>

                  {/* Store Activity / Management Subtitle */}
                  <div className="text-xs sm:text-sm font-bold text-black mt-1 px-14">
                    {settings.ownerName ? `بإدارة: ${settings.ownerName} · ` : ''}
                    {settings.enableWholesale 
                      ? 'تجارة عامة وبيع الجملة والمفرد' 
                      : 'تجارة عامة وبيع المفرد والتجزئة'}
                  </div>

                  {/* Address & Phone line (Displays only if configured) */}
                  {(settings.address || settings.phone) && (
                    <div className="text-[11px] sm:text-xs font-semibold text-black mt-1.5 pt-1 border-t border-dotted border-black/40 w-full text-center flex flex-wrap justify-center items-center gap-3">
                      {settings.address && <span>{settings.address}</span>}
                      {settings.address && settings.phone && <span>·</span>}
                      {settings.phone && <span>هاتف: {settings.phone}</span>}
                    </div>
                  )}

                </div>

                {/* 2. Metadata Bar */}
                <div className="grid grid-cols-3 items-center text-xs font-bold text-black border border-black/50 rounded-md px-3 py-1.5 bg-slate-50/60 print-keep-together gap-2">
                  {/* Right: Invoice # */}
                  <div className="flex items-center gap-1.5 whitespace-nowrap justify-start">
                    <span className="text-black/80 font-bold">رقم القائمة:</span>
                    <span className="font-mono text-sm font-black tracking-tight" dir="ltr">{invoice.invoiceNumber}</span>
                  </div>

                  {/* Center: Day & Date */}
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span className="text-black/80 font-bold">التاريخ:</span>
                    <span className="font-bold">{dayName}</span>
                    <span className="font-mono font-bold" dir="ltr">{dateFormatted}</span>
                  </div>

                  {/* Left: Time */}
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <span className="text-black/80 font-bold">الوقت:</span>
                    <span className="font-mono font-semibold" dir="ltr">{hours}:{minutes}:{seconds}</span>
                  </div>
                </div>

                {/* 3. Customer Info Boxes (حضرة السيد & العنوان / الهاتف) */}
                <div className="grid grid-cols-2 gap-2 text-xs print-keep-together">
                  <div className="border border-black rounded-md px-3 py-1.5 flex items-center justify-between">
                    <span className="font-bold text-black whitespace-nowrap">حضرة السيد:</span>
                    <span className="font-black text-sm text-black truncate pr-2">
                      {invoice.customerName || (invoice.type === 'direct' ? 'زبون نقدي مباشر' : 'عميل عام')}
                    </span>
                  </div>

                  <div className="border border-black rounded-md px-3 py-1.5 flex items-center justify-between">
                    <span className="font-bold text-black whitespace-nowrap">العنوان / الهاتف:</span>
                    <span className="font-medium text-black truncate pr-2">
                      {invoice.customerPhone ? invoice.customerPhone : (invoice.type === 'direct' ? 'بيع نقدي مباشر' : '-')}
                    </span>
                  </div>
                </div>

                {/* 4. Items Table matching standard invoice format without horizontal overflow */}
                <div className="w-full">
                  <table className="w-full text-right text-xs border-collapse border border-black table-fixed">
                    <thead>
                      <tr className="border-b border-black font-bold bg-slate-100">
                        <th rowSpan={2} className="border border-black py-1 px-1 text-center w-[6%] font-black">ت</th>
                        <th rowSpan={2} className="border border-black py-1 px-2 text-right w-[34%] font-black">المادة / التفاصيل</th>
                        <th rowSpan={2} className="border border-black py-1 px-1 text-center w-[7%] font-black">التجهيز</th>
                        <th colSpan={2} className="border border-black py-1 px-1 text-center font-black">الكمية</th>
                        <th rowSpan={2} className="border border-black py-1 px-1.5 text-center w-[15%] font-black">السعر</th>
                        <th rowSpan={2} className="border border-black py-1 px-1 text-center w-[9%] font-black">العملة</th>
                        <th rowSpan={2} className="border border-black py-1 px-2 text-center w-[13%] font-black">المبلغ</th>
                      </tr>
                      <tr className="border-b border-black font-bold bg-slate-100 text-[10px]">
                        <th className="border border-black py-0.5 px-1 text-center w-[8%]">كارتون</th>
                        <th className="border border-black py-0.5 px-1 text-center w-[8%]">قطعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => {
                        const unitLower = (item.unit || '').toLowerCase();
                        const isCarton = item.unitType === 'carton' || unitLower.includes('كرتون') || unitLower.includes('كارتون');
                        const isPiece = item.unitType === 'piece' || unitLower.includes('قطعة');
                        const otherUnit = !isCarton && !isPiece;

                        return (
                          <tr key={index} className="border-b border-black">
                            {/* ت */}
                            <td className="border border-black py-1.5 px-1 text-center font-mono font-bold">
                              {index + 1}
                            </td>

                            {/* التفاصيل */}
                            <td className="border border-black py-1.5 px-2 font-bold text-black text-xs sm:text-[13px] truncate">
                              {item.productName}
                            </td>

                            {/* التجهيز */}
                            <td className="border border-black py-1.5 px-1 text-center text-slate-800 font-bold">
                              ✓
                            </td>

                            {/* الكمية: كارتون */}
                            <td className="border border-black py-1.5 px-1 text-center font-mono font-bold">
                              {isCarton ? formatQty(item.quantity) : ''}
                            </td>

                            {/* الكمية: قطعة أو وحدة أخرى */}
                            <td className="border border-black py-1.5 px-1 text-center font-mono font-bold">
                              {isPiece ? formatQty(item.quantity) : otherUnit ? `${formatQty(item.quantity)} ${item.unit}` : ''}
                            </td>

                            {/* السعر */}
                            <td className="border border-black py-1.5 px-1 text-center font-mono font-bold" dir="ltr">
                              {item.unitPrice.toLocaleString()}
                            </td>

                            {/* العملة */}
                            <td className="border border-black py-1.5 px-1 text-center font-bold text-[10px]">
                              {currencyLabel}
                            </td>

                            {/* المبلغ الإجمالي للسطر */}
                            <td className="border border-black py-1.5 px-2 text-center font-mono font-black text-xs sm:text-sm" dir="ltr">
                              {item.total.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5. Bottom Financial Summary Ledger + Notes/Stamp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 print-keep-together">
                  
                  {/* Left side: Financial Ledger Table */}
                  <div className="w-full">
                    <table className="w-full text-right text-xs border-collapse border border-black table-fixed">
                      <thead>
                        <tr className="border-b border-black font-bold bg-slate-100">
                          <th className="border border-black py-1 px-2 text-right w-[50%]">البيان المالي</th>
                          <th className="border border-black py-1 px-1.5 text-center w-[30%]">المبلغ ({currencyLabel})</th>
                          <th className="border border-black py-1 px-1 text-center w-[20%]">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* مجموع المواد إذا كان هناك خصم */}
                        {discount > 0 && (
                          <>
                            <tr className="border-b border-black">
                              <td className="border border-black py-1 px-2 font-semibold">مجموع المواد</td>
                              <td className="border border-black py-1 px-1.5 text-center font-mono font-bold" dir="ltr">
                                {subtotal.toLocaleString()}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-semibold text-[10px] text-slate-500">-</td>
                            </tr>
                            <tr className="border-b border-black text-rose-700 font-bold">
                              <td className="border border-black py-1 px-2">الخصم الممنوح</td>
                              <td className="border border-black py-1 px-1.5 text-center font-mono font-bold" dir="ltr">
                                - {discount.toLocaleString()}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-semibold text-[10px]">خصم</td>
                            </tr>
                          </>
                        )}

                        {/* مبلغ القائمة الصافي */}
                        <tr className="border-b border-black font-bold">
                          <td className="border border-black py-1 px-2">مبلغ القائمة (الصافي)</td>
                          <td className="border border-black py-1 px-1.5 text-center font-mono font-bold" dir="ltr">
                            {invoiceTotal.toLocaleString()}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-semibold text-[10px] text-slate-600">حالي</td>
                        </tr>

                        {/* الديون السابقة */}
                        <tr className="border-b border-black font-bold">
                          <td className="border border-black py-1 px-2">الديون السابقة للزبون</td>
                          <td className="border border-black py-1 px-1.5 text-center font-mono font-bold" dir="ltr">
                            {previousDebt > 0 ? previousDebt.toLocaleString() : '0'}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-semibold text-[10px] text-amber-700">
                            {previousDebt > 0 ? 'مستحق' : 'لا يوجد'}
                          </td>
                        </tr>

                        {/* المجموع الكلي المطلوب */}
                        <tr className="border-b border-black font-black bg-slate-50">
                          <td className="border border-black py-1 px-2">المجموع الكلي المطلوب</td>
                          <td className="border border-black py-1 px-1.5 text-center font-mono font-black text-sm" dir="ltr">
                            {grandTotal.toLocaleString()}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-black text-[10px]">إجمالي</td>
                        </tr>

                        {/* التسديد (الواصل) */}
                        <tr className="border-b border-black font-bold">
                          <td className="border border-black py-1 px-2">الواصل (المسدد نقداً)</td>
                          <td className="border border-black py-1 px-1.5 text-center font-mono font-bold text-emerald-800" dir="ltr">
                            {paid > 0 ? paid.toLocaleString() : '0'}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-semibold text-[10px] text-emerald-700">
                            {paid >= grandTotal ? 'كامل' : paid > 0 ? 'جزئي' : 'أجل'}
                          </td>
                        </tr>

                        {/* مجموع الديون المتبقية */}
                        <tr className="font-black bg-slate-100">
                          <td className="border border-black py-1.5 px-2">الباقي بذمة العميل</td>
                          <td className="border border-black py-1.5 px-1.5 text-center font-mono font-black text-sm text-black" dir="ltr">
                            {totalRemainingDebt > 0 ? totalRemainingDebt.toLocaleString() : '0 (خالص)'}
                          </td>
                          <td className="border border-black py-1.5 px-1 text-center font-black text-[10px]">
                            {totalRemainingDebt === 0 ? 'مسدد' : 'باقي'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right side: Notes, Signatures & Stamp */}
                  <div className="w-full border border-black rounded p-2.5 flex flex-col justify-between text-xs">
                    <div>
                      <div className="font-bold text-black border-b border-dotted border-black/40 pb-1 mb-1.5 flex justify-between">
                        <span>ملاحظات القائمة:</span>
                        <span className="font-normal text-[10px] text-slate-500">ختم وتوقيع التجهيز</span>
                      </div>
                      <p className="text-[11px] text-slate-700 min-h-[44px] leading-relaxed">
                        {invoice.notes ? invoice.notes : 'تم تدقيق المواد والكميات المسجلة أعلاه ومطابقتها.'}
                      </p>
                    </div>

                    <div className="flex justify-between items-end pt-3 border-t border-dotted border-black/40 text-[11px] font-bold">
                      <div>توقيع البائع: ....................</div>
                      <div>توقيع المستلم: ....................</div>
                    </div>
                  </div>

                </div>

                {/* 6. Footer Note */}
                <div className="flex items-center justify-between border-t border-black pt-2 text-[10px] sm:text-[11px] font-bold text-black print-keep-together">
                  <span>صفحة 1</span>
                  <span>
                    {settings.invoiceFooterNote || 'ملاحظة: في حالة حصول خطأ أو سهو في التجهيز يجب إعلامنا في نفس اليوم'}
                  </span>
                </div>

              </div>
            ) : (
              /* Thermal 80mm Cashier Receipt Layout */
              <div className="space-y-3 leading-tight text-black font-mono">
                {/* Header */}
                <div className="text-center border-b border-dashed border-black pb-2">
                  <div className="font-black text-base">{settings.storeName || 'نظام المبيعات'}</div>
                  {settings.address && <div className="text-[10px] text-slate-700 mt-0.5">{settings.address}</div>}
                  {settings.phone && <div className="text-[10px] text-slate-700">{settings.phone}</div>}
                  <div className="font-bold text-xs mt-1 bg-slate-100 py-0.5 rounded">
                    {invoice.type === 'direct' ? '** وصل بيع نقدي مباشر **' : '** وصل بيع آجل (دين) **'}
                  </div>
                </div>

                {/* Meta */}
                <div className="text-[11px] space-y-0.5 border-b border-dashed border-black pb-2">
                  <div className="flex justify-between">
                    <span>رقم الوصل:</span>
                    <span className="font-bold">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span>{dayName} {dateFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الزبون:</span>
                    <span className="font-bold">{invoice.customerName || 'زبون نقدي مباشر'}</span>
                  </div>
                  {invoice.customerPhone && (
                    <div className="flex justify-between">
                      <span>الهاتف:</span>
                      <span>{invoice.customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-black pb-2 space-y-1.5">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="font-bold text-xs">{item.productName}</div>
                      <div className="flex justify-between text-[11px] text-slate-800">
                        <span>{formatQty(item.quantity)} × {item.unitPrice.toLocaleString()} ({item.unit || 'قطعة'})</span>
                        <span className="font-bold">{item.total.toLocaleString()} {currencyLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1 border-b border-dashed border-black pb-2 font-bold text-xs">
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>مجموع المواد:</span>
                        <span>{subtotal.toLocaleString()} {currencyLabel}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>الخصم:</span>
                        <span>{discount.toLocaleString()} {currencyLabel}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>مبلغ القائمة:</span>
                    <span>{invoiceTotal.toLocaleString()} {currencyLabel}</span>
                  </div>
                  {previousDebt > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>الديون السابقة:</span>
                      <span>{previousDebt.toLocaleString()} {currencyLabel}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black pt-1 border-t border-slate-300">
                    <span>المجموع الكلي:</span>
                    <span>{grandTotal.toLocaleString()} {currencyLabel}</span>
                  </div>
                  <div className="flex justify-between text-emerald-900">
                    <span>الواصل (التسديد):</span>
                    <span>{paid.toLocaleString()} {currencyLabel}</span>
                  </div>
                  <div className="flex justify-between text-black pt-1 border-t border-slate-300 font-black">
                    <span>المتبقي (الديون):</span>
                    <span>{totalRemainingDebt.toLocaleString()} {currencyLabel}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] pt-1 text-slate-700 space-y-0.5">
                  <p>{settings.invoiceFooterNote || 'في حالة حصول خطأ أو سهو في التجهيز يجب إعلامنا في نفس اليوم'}</p>
                  <p className="font-bold mt-1">شكراً لتعاملكم معنا</p>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
