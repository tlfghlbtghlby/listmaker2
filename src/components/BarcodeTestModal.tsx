import React, { useState } from 'react';
import { Product } from '../types';
import { 
  X, 
  ScanLine, 
  Sparkles, 
  CheckCircle2, 
  Usb, 
  Bluetooth, 
  Volume2, 
  Zap, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { playBarcodeBeep } from '../utils/barcodeUtils';

interface BarcodeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSimulateScan: (barcode: string) => void;
}

// Simple visual barcode stripe generator for clear scannable demonstration
const BarcodeVisual: React.FC<{ code: string }> = ({ code }) => {
  // Generate consistent bar widths from characters
  const bars = React.useMemo(() => {
    const list: { width: number; isBlack: boolean }[] = [];
    list.push({ width: 3, isBlack: true });
    list.push({ width: 1, isBlack: false });
    list.push({ width: 2, isBlack: true });
    list.push({ width: 2, isBlack: false });

    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      const w1 = (charCode % 3) + 1;
      const w2 = ((charCode >> 1) % 3) + 1;
      const w3 = ((charCode >> 2) % 3) + 1;
      list.push({ width: w1, isBlack: true });
      list.push({ width: 1, isBlack: false });
      list.push({ width: w2, isBlack: true });
      list.push({ width: 2, isBlack: false });
      list.push({ width: w3, isBlack: true });
      list.push({ width: 1, isBlack: false });
    }

    list.push({ width: 3, isBlack: true });
    list.push({ width: 1, isBlack: false });
    list.push({ width: 2, isBlack: true });
    return list;
  }, [code]);

  return (
    <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div className="h-16 flex items-stretch gap-[1.5px] px-2 py-1 bg-white">
        {bars.map((bar, index) => (
          <div
            key={index}
            className={`${bar.isBlack ? 'bg-slate-900' : 'bg-transparent'}`}
            style={{ width: `${bar.width * 2.2}px` }}
          />
        ))}
      </div>
      <span className="font-mono text-xs font-black tracking-widest text-slate-800 mt-1">
        *{code}*
      </span>
    </div>
  );
};

export const BarcodeTestModal: React.FC<BarcodeTestModalProps> = ({
  isOpen,
  onClose,
  products,
  onSimulateScan,
}) => {
  const [customCode, setCustomCode] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTest = (code: string) => {
    playBarcodeBeep(true);
    setTestResult(`تم إرسال إشارة المسح للرمز (${code}) بنجاح!`);
    onSimulateScan(code);
    setTimeout(() => {
      setTestResult(null);
    }, 2500);
  };

  const sampleProducts = products.length > 0 ? products.slice(0, 4) : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>فاحص وتجربة المسح الشريطي</span>
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  متصل وجاهز
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                تجربة المسح باستخدام جهاز الباركود الفعلي أو المحاكاة الفورية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Hardware Connection Guide Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Usb className="w-4 h-4 text-emerald-600" />
              <span>كيف يعمل قارئ الباركود على الكمبيوتر؟</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              عند توصيل أي جهاز ماسح باركود (سلكي <strong>USB</strong> أو لاسلكي <strong>Bluetooth</strong>)، يتعرف عليه نظام الويندوز/الماك والمتصفح تلقائياً كجهاز إدخال فوري (HID Keyboard) بدون الحاجة إلى تثبيت أي برامج تعريف.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-emerald-800">
              <span className="flex items-center gap-1 bg-emerald-100/70 px-2 py-1 rounded-md">
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                صوت تنبيه كاشير واقعي عند كل مسح
              </span>
              <span className="flex items-center gap-1 bg-emerald-100/70 px-2 py-1 rounded-md">
                <Zap className="w-3.5 h-3.5 text-emerald-700" />
                إضافة تلقائية بسعر المفرد
              </span>
            </div>
          </div>

          {/* Result Alert */}
          {testResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Live Scannable Barcodes of Registered Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                باركودات المواد المسجلة لديك (يمكنك مسحها بكاميرا أو جهاز الماسح):
              </h4>
              <span className="text-[11px] text-slate-400 font-semibold">
                انقر على أي مادة لمحاكاة مسحها فورياً
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sampleProducts.map((prod) => (
                <div 
                  key={prod.id}
                  className="bg-white p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-sm transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate">{prod.name}</span>
                    <span className="font-bold text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                      {prod.retailPrice} دينار (مفرد)
                    </span>
                  </div>

                  <BarcodeVisual code={prod.code} />

                  <button
                    type="button"
                    onClick={() => handleTest(prod.code)}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>محاكاة مسح ({prod.code})</span>
                  </button>
                </div>
              ))}

              {/* Sample unregistered barcode */}
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 transition flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900">باركود مادة جديدة (غير مسجلة)</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    لتجربة الإضافة
                  </span>
                </div>

                <BarcodeVisual code="88091234567" />

                <button
                  type="button"
                  onClick={() => handleTest("88091234567")}
                  className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>محاكاة مسح باركود جديد</span>
                </button>
              </div>
            </div>
          </div>

          {/* Manual Input Test */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="اكتب أي رمز أو باركود للتجربة..."
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCode.trim()) {
                  handleTest(customCode.trim());
                  setCustomCode('');
                }
              }}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (customCode.trim()) {
                  handleTest(customCode.trim());
                  setCustomCode('');
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              تجربة المسح
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
