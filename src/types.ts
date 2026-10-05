export type SaleType = 'direct' | 'credit'; // بيع مباشر (نقدي) أو بيع آجل (دين)
export type PriceType = 'retail' | 'wholesale'; // سعر البيع العادي أو سعر الجملة
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid';

export interface Product {
  id: string;
  code: string; // كود المادة أو الباركود
  name: string; // اسم المادة
  category: string; // التصنيف (غذائية، إنشائية، كهربائية، أدوات منزلية، إلخ)
  unit: string; // الوحدة (قطعة، كرتونة، كيس، كيلو، لتر، متر)
  costPrice: number; // سعر الجملة / الشراء (التكلفة)
  retailPrice: number; // سعر البيع المباشر (مفرق)
  wholesalePrice: number; // سعر بيع الجملة
  stock: number; // إجمالي القطع المتوفرة بالمخزن
  piecesPerCarton?: number; // كم يحتوي الكارتون الواحد من قطع (مثال: 6 قطع في الكارتون)
  cartonCostPrice?: number; // سعر شراء الكرتون الكامل
  cartonRetailPrice?: number; // سعر بيع الكرتون الكامل (مفرد)
  cartonWholesalePrice?: number; // سعر بيع الكرتون الكامل (جملة)
  minStock: number; // الحد الأدنى للتنبيه عند قرب النفاد
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalDebt: number; // إجمالي الدين المستحق الحالي
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  code: string;
  unit: string;
  priceType: PriceType; // سعر البيع المطبق
  unitType?: 'piece' | 'carton'; // نوع البيع: بالقطعة أو بالكرتون
  piecesPerCarton?: number; // سعة الكرتون
  deductedPieces?: number; // إجمالي القطع المخصومة من رصيد المخزن
  costPrice: number; // سعر الشراء لحساب الربح
  unitPrice: number; // سعر البيع للوحدة
  quantity: number; // الكمية
  total: number; // المجموع للسطر
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // رقم القائمة
  type: SaleType; // مباشر أم آجل
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // خصم نقدي
  total: number; // المبلغ الإجمالي المطلوب
  paidAmount: number; // المبلغ المسدد حالياً
  remainingAmount: number; // المبلغ المتبقي (آجل)
  previousDebt: number; // دين الزبون السابق قبل هذه الفاتورة
  currentTotalDebt: number; // إجمالي دين الزبون الجديد بعد هذه الفاتورة
  paymentDueDate?: string; // موعد استحقاق الدفع للآجل
  status: InvoiceStatus;
  notes?: string;
  date: string; // تاريخ ووقت الإنشاء
  totalCost: number; // تكلفة البضاعة المباعة
  netProfit: number; // صافي الربح المحقق (total - totalCost - discount)
}

export interface CreateInvoiceInput {
  type: SaleType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  discount: number;
  paidAmount: number;
  paymentDueDate?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  notes?: string;
  receiptNumber: string;
}

export type DeviceMode = 'desktop' | 'mobile';
export type DesktopLayoutMode = 'full' | 'partial'; // وضع الكمبيوتر الكامل | وضع الكمبيوتر الجزئي

export type UserRole = 'admin' | 'client';
export const ADMIN_EMAIL = 'tlfghlbtghlby@gmail.com';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  storeName: string;
  phone?: string;
  password?: string;
  role: UserRole;
  isActive?: boolean;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  phone: string;
  address: string;
  currency: string; // مثلاً: د.ع (دينار عراقي) أو $ أو ر.س
  defaultCategory?: string; // الفئة الأساسية أو الفئة الافتراضية للمواد
  invoiceFooterNote: string;
  printFormat: 'a4' | 'thermal'; // A4 رسمي أو رول 80 مم
  enableWholesale: boolean; // تفعيل أو إلغاء إظهار سعر بيع الجملة
  deviceMode: DeviceMode; // وضع الحاسبة أو وضع الهاتف (Android / iPhone)
  desktopLayout: DesktopLayoutMode; // 'full' = وضع الكمبيوتر الكامل (شاشة مستطيلة جانبية: المواد وبجانبها القائمة), 'partial' = وضع الكمبيوتر الجزئي
}
