import React, { useState } from 'react';
import { loginWithEmailOrUsername } from '../firebase';
import { 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  Cloud, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface AuthViewProps {
  onSuccess: () => void;
  onContinueAsGuest?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetIdentifier = identifier.trim();
    if (!targetIdentifier) {
      setErrorMessage('يرجى إدخال اسم المستخدم أو البريد الإلكتروني أو الهاتف');
      return;
    }
    if (!password) {
      setErrorMessage('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithEmailOrUsername(targetIdentifier, password);
      setSuccessMessage('تم تسجيل الدخول بنجاح! جاري تحميل بياناتك ومزامنتها...');
      setTimeout(() => {
        onSuccess();
      }, 600);
    } catch (err: any) {
      console.error("Login error:", err);
      let msg = 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار دقيقة واحدة.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بالسيرفر. يرجى التأكد من اتصالك بالإنترنت.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-600 selection:text-white" dir="rtl">
      
      <div className="w-full max-w-md my-auto">
        
        {/* Brand & Cloud Status Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-900/40 mb-1 font-black text-2xl">
            ن
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            نظام إدارة المبيعات والمخزن
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Cloud className="w-3.5 h-3.5" />
            <span>نظام تسجيل الدخول الحصري المرخص</span>
          </div>
        </div>

        {/* Main Login Card (مقتصرة على تسجيل الدخول فقط) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 sm:p-7 space-y-5">
          
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900">تسجيل الدخول للنظام</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              حساب مفعل
            </span>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form: Only 2 inputs (اسم المستخدم/البريد/الهاتف) و (كلمة المرور) */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Input 1: Identifier (اسم المستخدم أو البريد أو الهاتف) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم / البريد الإلكتروني / الهاتف
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد"
                  required
                  autoFocus
                  className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
            </div>

            {/* Input 2: Password (كلمة المرور) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Login Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الدخول والتحقق...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          {/* Secure note */}
          <div className="pt-2 text-center text-slate-400 text-xs border-t border-slate-100">
            <span>إصدار تراخيص الحسابات يتم حصراً عبر إدارة النظام</span>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-400">
          نظام المبيعات والمخزن السحابي · مزامنة فورية وحفظ دائم
        </div>

      </div>

    </div>
  );
};

export default AuthView;
