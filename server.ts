import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Ensure data directory exists for persistent storage across devices
const DATA_DIR = path.join(__dirname, 'data_storage');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getStoreFilePath = (userId: string) => {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `store_${safeId}.json`);
};

// Health check endpoint for network sensing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// GET /api/sync/:userId - Pull latest store data from cloud/server
app.get('/api/sync/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getStoreFilePath(userId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, data });
    }
    return res.json({ success: true, data: null });
  } catch (error: any) {
    console.error('Error reading store sync file:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sync/:userId - Push and smartly merge updated store data with server
app.post('/api/sync/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const incomingData = req.body;
    const filePath = getStoreFilePath(userId);

    let existingData: any = null;
    if (fs.existsSync(filePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        existingData = null;
      }
    }

    // If client requested a full forced reset (e.g. user clicked Reset to Zero in settings)
    if (incomingData.isForceReset) {
      const payload = {
        products: incomingData.products || [],
        invoices: incomingData.invoices || [],
        customers: incomingData.customers || [],
        settings: incomingData.settings || {},
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      return res.json({ success: true, data: payload, updatedAt: payload.updatedAt });
    }

    if (!existingData) {
      // First time saving for this user
      const payload = {
        ...incomingData,
        products: incomingData.products || [],
        invoices: incomingData.invoices || [],
        customers: incomingData.customers || [],
        settings: incomingData.settings || {},
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      return res.json({ success: true, data: payload, updatedAt: payload.updatedAt });
    }

    // Smart Merge to completely prevent empty client state from wiping existing server data
    // 1. Products: If incoming is empty but server has products, preserve server products!
    let mergedProducts = existingData.products || [];
    if (Array.isArray(incomingData.products) && incomingData.products.length > 0) {
      const productMap = new Map<string, any>();
      // Seed with existing products
      for (const p of (existingData.products || [])) {
        if (p && p.id) productMap.set(p.id, p);
      }
      // Merge incoming products (prefer newer updatedAt or incoming)
      for (const p of incomingData.products) {
        if (!p || !p.id) continue;
        const existing = productMap.get(p.id);
        if (!existing) {
          productMap.set(p.id, p);
        } else {
          const incomingTime = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (incomingTime >= existingTime) {
            productMap.set(p.id, p);
          }
        }
      }
      mergedProducts = Array.from(productMap.values());
    }

    // 2. Invoices: Merge all unique invoices so no sales are ever lost across devices
    let mergedInvoices = existingData.invoices || [];
    if (Array.isArray(incomingData.invoices)) {
      const invoiceMap = new Map<string, any>();
      for (const inv of (existingData.invoices || [])) {
        if (inv && inv.id) invoiceMap.set(inv.id, inv);
      }
      for (const inv of incomingData.invoices) {
        if (inv && inv.id) invoiceMap.set(inv.id, inv);
      }
      mergedInvoices = Array.from(invoiceMap.values()).sort((a, b) => {
        const timeA = new Date(a.date || 0).getTime();
        const timeB = new Date(b.date || 0).getTime();
        return timeB - timeA;
      });
    }

    // 3. Customers: Merge by ID
    let mergedCustomers = existingData.customers || [];
    if (Array.isArray(incomingData.customers) && incomingData.customers.length > 0) {
      const customerMap = new Map<string, any>();
      for (const c of (existingData.customers || [])) {
        if (c && c.id) customerMap.set(c.id, c);
      }
      for (const c of incomingData.customers) {
        if (c && c.id) customerMap.set(c.id, c);
      }
      mergedCustomers = Array.from(customerMap.values());
    }

    // 4. Settings: Keep incoming if provided, or merge
    const mergedSettings = {
      ...(existingData.settings || {}),
      ...(incomingData.settings || {}),
    };

    const payload = {
      products: mergedProducts,
      invoices: mergedInvoices,
      customers: mergedCustomers,
      settings: mergedSettings,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return res.json({ success: true, data: payload, updatedAt: payload.updatedAt });
  } catch (error: any) {
    console.error('Error saving store sync file:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Users Management Endpoints
const USERS_FILE = path.join(DATA_DIR, 'registered_clients.json');

app.get('/api/admin/users', (req, res) => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      return res.json({ success: true, users: JSON.parse(content) });
    }
    return res.json({ success: true, users: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const newUser = req.body;
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
    users = users.filter((u: any) => u.uid !== newUser.uid);
    users.unshift(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users/:userId/status', (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      users = users.map((u: any) => u.uid === userId ? { ...u, isActive } : u);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update client or admin account details (اسم، محل، هاتف، كلمة مرور، صلاحية)
app.put('/api/admin/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    let users: any[] = [];
    if (fs.existsSync(USERS_FILE)) {
      try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      } catch (e) {
        users = [];
      }
    }

    let found = false;
    users = users.map((u: any) => {
      if (u.uid === userId) {
        found = true;
        return {
          ...u,
          displayName: updates.displayName !== undefined ? updates.displayName : u.displayName,
          storeName: updates.storeName !== undefined ? updates.storeName : u.storeName,
          phone: updates.phone !== undefined ? updates.phone : u.phone,
          password: updates.password ? updates.password : u.password,
          role: updates.role !== undefined ? updates.role : (u.role || 'client'),
          email: updates.email !== undefined ? updates.email : u.email,
          username: updates.username !== undefined ? updates.username : u.username,
          isActive: updates.isActive !== undefined ? updates.isActive : (u.isActive ?? true),
          updatedAt: new Date().toISOString()
        };
      }
      return u;
    });

    if (!found) {
      users.push({
        uid: userId,
        displayName: updates.displayName || 'مستخدم',
        storeName: updates.storeName || '',
        phone: updates.phone || '',
        password: updates.password || '',
        role: updates.role || 'client',
        email: updates.email || '',
        username: updates.username || updates.displayName || '',
        isActive: updates.isActive !== undefined ? updates.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Fast lookup endpoint by Phone Number, Username, or Email
app.get('/api/auth/lookup', (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.json({ success: true, user: null });
    }

    // Helper to normalize phone numbers
    const normalizePhone = (phone: string | undefined | null) => {
      if (!phone) return '';
      const arabicNumerals = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
      let str = phone.toString();
      arabicNumerals.forEach((digit, i) => {
        str = str.split(digit).join(i.toString());
      });
      const digits = str.replace(/\D/g, '');
      if (digits.startsWith('964') && digits.length >= 12) return '0' + digits.slice(3);
      if (digits.startsWith('00964') && digits.length >= 14) return '0' + digits.slice(5);
      return digits;
    };

    const normQuery = normalizePhone(query);
    const lowerQuery = query.toLowerCase();

    // 1. Search in registered_clients.json
    let users: any[] = [];
    if (fs.existsSync(USERS_FILE)) {
      try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      } catch (e) {
        users = [];
      }
    }

    const matched = users.find((u: any) => {
      const uPhoneNorm = normalizePhone(u.phone);
      const phoneMatch = normQuery.length >= 7 && (
        uPhoneNorm === normQuery ||
        uPhoneNorm.endsWith(normQuery) ||
        normQuery.endsWith(uPhoneNorm)
      );
      const userMatch = (u.username || '').toLowerCase() === lowerQuery;
      const emailMatch = (u.email || '').toLowerCase() === lowerQuery;
      return phoneMatch || userMatch || emailMatch;
    });

    if (matched) {
      return res.json({ success: true, user: matched });
    }

    // 2. Fallback search across store files for settings.phone
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('store_') && f.endsWith('.json'));
      for (const file of files) {
        try {
          const storeContent = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
          const sPhone = storeContent.settings?.phone;
          const sPhoneNorm = normalizePhone(sPhone);
          if (normQuery.length >= 7 && sPhoneNorm && (sPhoneNorm === normQuery || sPhoneNorm.endsWith(normQuery) || normQuery.endsWith(sPhoneNorm))) {
            const uid = file.replace(/^store_/, '').replace(/\.json$/, '');
            return res.json({
              success: true,
              user: {
                uid,
                displayName: storeContent.settings?.ownerName || storeContent.settings?.storeName || 'صاحب المتجر',
                storeName: storeContent.settings?.storeName || '',
                phone: sPhone,
                role: 'client',
                isActive: true
              }
            });
          }
        } catch (e) {}
      }
    }

    return res.json({ success: true, user: null });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete client account
app.delete('/api/admin/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      users = users.filter((u: any) => u.uid !== userId);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

      // Also clean up client store file if it exists
      const storePath = getStoreFilePath(userId);
      if (fs.existsSync(storePath)) {
        try {
          fs.unlinkSync(storePath);
        } catch (e) {}
      }

      return res.json({ success: true });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'dist'));

  if (process.env.NODE_ENV !== 'production' && !process.env.PREVIEW_MODE) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback to serving transformed index.html for SPA routes
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
