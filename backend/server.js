const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== SUPABASE =====
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===== MULTER (memory storage) =====
const upload = multer({ storage: multer.memoryStorage() });

// ===== JWT MIDDLEWARE =====
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided.' });
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only.' });
    next();
  });
}

// ===== AUTH ROUTES =====
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'All fields required.' });
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({ email, username, password_hash: hash, coins: 0 })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  const token = jwt.sign({ id: data.id, email, is_admin: false }, process.env.JWT_SECRET);
  res.json({ token, user: data });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user, error } = await supabase
    .from('users')
    .select()
    .eq('email', email)
    .single();
  if (error || !user) return res.status(400).json({ error: 'User not found.' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(400).json({ error: 'Wrong password.' });
  const token = jwt.sign(
    { id: user.id, email, is_admin: user.is_admin },
    process.env.JWT_SECRET
  );
  res.json({ token, user });
});

// ===== BALANCE =====
app.get('/api/balance', auth, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('coins')
    .eq('id', req.user.id)
    .single();
  res.json({ coins: data?.coins || 0 });
});

// ===== TRANSACTIONS =====
app.get('/api/transactions', auth, async (req, res) => {
  const { data } = await supabase
    .from('transactions')
    .select()
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// ===== DEPOSIT REQUEST =====
app.post('/api/deposit/request', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum 10 coins.' });
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: req.user.id, amount, status: 'pending' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ===== STREAM START =====
app.post('/api/stream/start', auth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('coins')
    .eq('id', req.user.id)
    .single();
  if (!user || user.coins < 10) return res.status(403).json({ error: '❌ Insufficient coins. Minimum 10 required.' });
  // Deduct 10 coins
  await supabase
    .from('users')
    .update({ coins: user.coins - 10 })
    .eq('id', req.user.id);
  res.json({ success: true, message: 'Stream started. 10 coins deducted.' });
});

// ===== FILE UPLOAD =====
app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided.' });
  const ext = file.originalname.split('.').pop();
  const fileName = `${uuidv4()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .upload(`public/${fileName}`, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });
  if (error) return res.status(400).json({ error: error.message });
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/user-uploads/public/${fileName}`;
  res.json({ url });
});

// ===== ADMIN ROUTES =====
app.get('/api/admin/pending', adminAuth, async (req, res) => {
  const { data } = await supabase
    .from('transactions')
    .select('*, users(email, username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/api/admin/confirm', adminAuth, async (req, res) => {
  const { transaction_id } = req.body;
  const { data: tx } = await supabase
    .from('transactions')
    .select()
    .eq('id', transaction_id)
    .single();
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  // Update transaction
  await supabase
    .from('transactions')
    .update({ status: 'confirmed', confirmed_at: new Date() })
    .eq('id', transaction_id);
  // Add coins
  const { data: user } = await supabase
    .from('users')
    .select('coins')
    .eq('id', tx.user_id)
    .single();
  await supabase
    .from('users')
    .update({ coins: (user.coins || 0) + tx.amount })
    .eq('id', tx.user_id);
  res.json({ success: true, message: `${tx.amount} coins released.` });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('id, email, username, coins, created_at')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// ===== HEALTH CHECK =====
app.get('/', (req, res) => res.json({ status: '🔥 Almighty Taker Studio API running' }));

// ===== BRANDING =====
app.use((req, res, next) => {
  res.setHeader('X-Developed-By', 'Almighty Taker');
  next();
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
