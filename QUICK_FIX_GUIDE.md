# 🚨 QUICK FIX GUIDE - STOP ERRORS NOW

## 🛑 **IMMEDIATE FIXES**

### **1. STOP ALL PROCESSES**
```bash
# Kill all running processes
pkill -f "npm run dev"
pkill -f "npm run worker"
pkill -f node
```

### **2. CLEAR REDIS (Stop automatic jobs)**
```bash
# Connect to Redis and clear all data
redis-cli
FLUSHALL
exit
```

### **3. SETUP DATABASE (Fixed version)**
1. Go to Supabase → SQL Editor
2. **USE THIS FIXED SQL** (copy from `backend/src/config/database-schema-fixed.sql`):

```sql
-- Create users table (extends Clerk user data)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create research_jobs table
CREATE TABLE IF NOT EXISTS research_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  message TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create paper_context table
CREATE TABLE IF NOT EXISTS paper_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  abstract TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_user_id ON research_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_session_id ON research_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_paper_context_session_id ON paper_context(session_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_research_jobs_updated_at ON research_jobs;
CREATE TRIGGER update_research_jobs_updated_at BEFORE UPDATE ON research_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **4. CREATE ENVIRONMENT FILES**

**Backend `.env`** (create in `backend/.env`):
```env
PORT=3000
CORS_ORIGIN=*
GEMINI_API_KEY=your-gemini-api-key-here
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
GROBID_URL=https://cloud.science-miner.com/grobid
UNPAYWALL_EMAIL=your-email@example.com
ENABLE_RESEARCH_WORKER=false
RESEARCH_WORKER_CONCURRENCY=1
RESEARCH_MAX_RESULTS=5
SCHOLAR_ENABLED=true
DEFAULT_SOURCES=scholar,arxiv,pubmed,openalex
HYBRID_W_BM25=0.5
HYBRID_W_EMBED=0.5
DEBUG=researchai:*
```

**Frontend `.env`** (create in `frontend/.env`):
```env
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key-here
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### **5. START CLEAN**
```bash
# Terminal 1: Backend API only (no worker)
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## ✅ **WHAT SHOULD WORK NOW**

1. **Frontend loads** at http://localhost:5173 ✅
2. **No automatic jobs** (worker disabled) ✅
3. **Can sign in** with Clerk ✅
4. **Can create session** (with fallback if DB not ready) ✅
5. **Database errors handled gracefully** ✅

## 🔑 **GET YOUR API KEYS**

### **Clerk (Required)**
1. Go to [clerk.com](https://clerk.com)
2. Sign up → Create application
3. Copy `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

### **Supabase (Required)**  
1. Go to [supabase.com](https://supabase.com)
2. Create project
3. Settings → API → Copy URL and keys

### **Gemini (Required)**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key

## 🎯 **TEST WORKFLOW**

1. **Open** http://localhost:5173
2. **Sign in** with Clerk
3. **Click "Create Research Session"**
4. **Type query**: "machine learning"
5. **Click "Research"** 

**Expected**: Should work without automatic background jobs!

## 🐛 **IF STILL ISSUES**

1. **Check logs** for specific errors
2. **Verify API keys** are correct
3. **Ensure Redis is running**: `redis-cli ping`
4. **Check database** in Supabase

The app should now work without the automatic job processing and database errors! 🎉