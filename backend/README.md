# 🔥 Almighty Taker RealTime Studio

Real‑time AI live streaming platform with coin economy, authentication, admin dashboard, and file management.

## 🚀 Deployment

### Backend (Render)
1. Connect this repo to Render as a Web Service
2. Root directory: `backend`
3. Build: `npm install`
4. Start: `npm start`
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET`

### Frontend (Render or Vercel)
1. Deploy `frontend/` as a Static Site
2. Update `API_URL` in `script.js` to your Render backend URL

## 🗄️ Database (Supabase)

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  coins INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  confirmed_at TIMESTAMP
);
