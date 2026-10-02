import React, { useState, useEffect } from 'react';
import { 
  createClientAccount, 
  loadAllClientAccounts, 
  toggleClientAccountStatus,
  updateClientAccount,
  deleteClientAccount,
  CreateClientInput,
  UpdateClientInput
} from '../firebase';
import { UserProfile, ADMIN_EMAIL } from '../types';
import { 
  ShieldCheck, 
  UserPlus, 
  Users, 
  Store, 
  Phone, 
  Lock, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  RefreshCw,
  Power,
  Pencil,
  Trash2,
  X,
  Save,
  Check,
  KeyRound,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form fields for new client
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Edit modal state
  const [editingClient, setEditingClient] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Password visibility map (default: all passwords visible)
  const [hiddenPasswords, setHiddenPasswords] = useState<Record<string, boolean>>({});
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const list = await loadAllClientAccounts();
      setClients(list);
    } catch (e: any) {
      console.error("Error loading clients:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setFeedback({ type: 'error', message: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني للزبون' });
      return;
    }
    if (!password || password.length < 6) {
      setFeedback({ type: 'error', message: 'يجب أن تكون كلمة المرور 6 خانات أو أكثر' });
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateClientInput = {
        username: cleanUsername,
        password,
        displayName: displayName.trim() || cleanUsername,
        storeName: storeName.trim() || `مخزن ${cleanUsername}`,
        phone: phone.trim()
      };

      // Call secondary app function to create client without logging out admin!
      const newClient = await createClientAccount(input);

      setFeedback({
        type: 'success',
        message: `تم إنشاء وتفعيل حساب الزبون (${newClient.displayName}) بنجاح! اسم الدخول: ${cleanUsername} · الرمز: ${password}`
      });

      // Clear form
      setUsername('');
      setDisplayName('');
      setStoreName('');
      setPhone('');
      setPassword('');

      // Refresh clients list
      fetchClients();
    } catch (err: any) {
      console.error("Error creating client:", err);
      let msg = err.message || 'حدث خطأ أثناء إنشاء حساب الزبون';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'اسم المستخدم أو البريد مستخدم مسبقاً، يرجى اختيار اسم مستخدم آخر.';
      }
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (client: UserProfile) => {
    setEditingClient(client);
    setEditDisplayName(client.displayName || '');
    setEditStoreName(client.storeName || '');
    setEditPhone(client.phone || '');
    setEditPassword(client.password || '');
    setEditIsActive(client.isActive !== false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    setIsSavingEdit(true);
    try {
      const updates: UpdateClientInput = {
        uid: editingClient.uid,
        displayName: editDisplayName.trim() || editingClient.username,
        storeName: editStoreName.trim() || editingClient.storeName,
        phone: editPhone.trim(),
        isActive: editIsActive,
      };

      if (editPassword && editPassword.trim().length >= 6) {
        updates.password = editPassword.trim();
      }

      await updateClientAccount(updates);

      setFeedback({
        type: 'success',
        message: `تم تحديث بيانات حساب الزبون (${updates.displayName}) ورمز المرور بنجاح.`
      });

      setEditingClient(null);
      fetchClients();
    } catch (err: any) {
      console.error("Error updating client:", err);
      setFeedback({ type: 'error', message: err.message || 'فشل حفظ تعديلات الحساب' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteClient = async (client: UserProfile) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف حساب الزبون (${client.displayName || client.username}) نهائياً؟\n\nتنبيه: سيتم مسح الحساب وبياناته ومخزنه من السيرفر نهائياً.`
    );

    if (!confirmDelete) return;

    try {
      await deleteClientAccount(client.uid);
      setFeedback({
        type: 'success',
        message: `تم حذف حساب الزبون (${client.displayName || client.username}) نهائياً.`
      });
      setClients(prev => prev.filter(c => c.uid !== client.uid));
    } catch (err: any) {
      console.error("Error deleting client:", err);
      setFeedback({ type: 'error', message: err.message || 'فشل حذف الحساب' });
    }
  };

  const handleToggleStatus = async (client: UserProfile) => {
    const nextStatus = client.isActive === false ? true : false;
    const confirmMsg = nextStatus 
      ? `هل تريد تفعيل حساب (${client.displayName})؟`
      : `هل تريد إيقاف وتعطيل حساب (${client.displayName})؟`;
    
    if (window.confirm(confirmMsg)) {
      await toggleClientAccountStatus(client.uid, nextStatus);
      setClients(prev => prev.map(c => c.uid === client.uid ? { ...c, isActive: nextStatus } : c));
    }
  };

  const copyPasswordToClipboard = (pwd: string, name: string, uid: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
    setFeedback({
      type: 'success',
      message: `تم نسخ كلمة المرور الخاصة بحساب (${name}) بنجاح: ${pwd}`
    });
  };

  const togglePasswordVisibility = (uid: string) => {
    setHiddenPasswords(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }));
  };

  const filteredClients = clients.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q) ||
      c.storeName?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.password?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-emerald-500/40 shadow-xl p-5 sm:p-6 space-y-6">
      
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">لوحة تحكم المدير العام</h2>
              <span className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                صلاحية الإدارة العليا (Admin)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              الحساب المرخص: <span className="text-emerald-400 font-mono font-bold">{ADMIN_EMAIL}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchClients}
          disabled={isLoading}
          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>تحديث قائمة الزبائن</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300' 
            : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{feedback.message}</span>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="p-1 hover:bg-white/10 rounded cursor-pointer text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Create New Client Account Form */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
          <UserPlus className="w-4 h-4" />
          <span>إنشاء حساب زبون جديد (إصدار ترخيص مستخدم)</span>
        </div>
        <p className="text-xs text-slate-400">
          يتم إنشاء الحساب عبر تطبيق فرعي مؤقت (Secondary App) وتفعيله فورياً في أقل من ثانية دون التأثير على جلسة الأدمن.
        </p>

        <form onSubmit={handleCreateClient} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم المستخدم للزبون <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: ahmed_store"
                  className="w-full pl-3 pr-9 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رمز الحساب (كلمة المرور) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف أو أرقام على الأقل"
                  className="w-full pl-3 pr-9 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم المحل أو المخزن
              </label>
              <div className="relative">
                <Store className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="مثال: أسواق النور للمواد الغذائية"
                  className="w-full pl-3 pr-9 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Client Display Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم صاحب المحل / الزبون
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: أحمد عبد الله"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف (اختياري)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0770xxxxxxx"
                  className="w-full pl-3 pr-9 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer h-[34px]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري إنشاء وتفعيل الحساب...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إنشاء حساب الزبون الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Clients Accounts Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">حسابات الزبائن المسجلة في النظام ({clients.length})</h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، المحل، أو الرمز..."
              className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-800/40">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/90 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">اسم الزبون</th>
                <th className="py-2.5 px-3">اسم المستخدم / الحساب</th>
                <th className="py-2.5 px-3">اسم المحل</th>
                <th className="py-2.5 px-3">الهاتف</th>
                <th className="py-2.5 px-3 text-center">رمز الحساب (كلمة المرور)</th>
                <th className="py-2.5 px-3 text-center">حالة الحساب</th>
                <th className="py-2.5 px-3 text-center">الإجراءات والتحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد حسابات زبائن مسجلة بعد. استخدم النموذج أعلاه لإنشاء حساب جديد.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isActive = client.isActive !== false;
                  const isHidden = hiddenPasswords[client.uid] ?? false;
                  const hasPassword = Boolean(client.password);
                  const isCopied = copiedUid === client.uid;

                  return (
                    <tr key={client.uid} className="hover:bg-slate-800/60 transition">
                      <td className="py-2.5 px-3 font-bold text-white">
                        {client.displayName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-300">
                        {client.username}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {client.storeName || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-left" dir="ltr">
                        {client.phone || '-'}
                      </td>
                      
                      {/* Password Field Column - Visible for Admin */}
                      <td className="py-2.5 px-3 text-center">
                        {hasPassword ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 shadow-xs">
                            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span 
                              className="font-mono text-emerald-300 font-bold select-all tracking-wider text-xs px-1" 
                              dir="ltr"
                            >
                              {isHidden ? '••••••••' : client.password}
                            </span>
                            
                            {/* Toggle Show/Hide Icon */}
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(client.uid)}
                              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition"
                              title={isHidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'}
                            >
                              {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>

                            {/* Copy Password Button */}
                            <button
                              type="button"
                              onClick={() => copyPasswordToClipboard(client.password!, client.displayName, client.uid)}
                              className={`p-0.5 rounded cursor-pointer transition ${
                                isCopied ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                              }`}
                              title="نسخ كلمة المرور"
                            >
                              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px] bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                            مُشفر سحابياً
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isActive 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {isActive ? 'مفعل نشط' : 'معطل'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Client Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="p-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-800/70"
                            title="تعديل بيانات الحساب وكلمة المرور"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(client)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isActive
                                ? 'bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-800/70'
                                : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/70'
                            }`}
                            title={isActive ? 'تعطيل الحساب' : 'إعادة تفعيل الحساب'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Client Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client)}
                            className="p-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/70"
                            title="حذف الحساب نهائياً من النظام"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Edit Client Account Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Pencil className="w-4 h-4" />
                <h3 className="text-sm font-black text-white">
                  تعديل بيانات الحساب: <span className="text-emerald-400 font-mono">{editingClient.username}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم صاحب المحل / الزبون
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Store Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم المحل أو المخزن
                  </label>
                  <input
                    type="text"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                {/* Current / New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>رمز الحساب (كلمة المرور)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">ظاهر للأدمن</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      minLength={6}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      className="w-full pl-3 pr-9 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-emerald-300 font-bold focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Status Radio */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">حالة نشاط الحساب:</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="accountStatus"
                      checked={editIsActive}
                      onChange={() => setEditIsActive(true)}
                      className="accent-emerald-500"
                    />
                    <span>نشط ومفعل</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-rose-400 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="accountStatus"
                      checked={!editIsActive}
                      onChange={() => setEditIsActive(false)}
                      className="accent-rose-500"
                    />
                    <span>معطل وموقوف</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري حفظ التعديلات...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
