# 🎯 Quick Fix Checklist

## Copy-Paste These Commands

### 1️⃣ Check Your Database Table Name
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspace_users', 'workspace_collaborators');
```

### 2️⃣ Run SQL Migrations

**Option A: If you see `workspace_collaborators`** ✅ (MOST LIKELY)
```sql
-- Run FIX_TABLE_NAMING_ISSUE.sql first (Option 1)
DROP VIEW IF EXISTS workspace_users CASCADE;
CREATE VIEW workspace_users AS SELECT * FROM workspace_collaborators;
GRANT ALL ON workspace_users TO authenticated;
GRANT ALL ON workspace_users TO service_role;

-- Then run ADD_PINNED_PAPERS.sql
-- (Copy entire file contents and paste)
```

**Option B: If you see `workspace_users`**
```sql
-- Run FIX_TABLE_NAMING_ISSUE.sql (Option 2)
DROP VIEW IF EXISTS workspace_collaborators CASCADE;
CREATE VIEW workspace_collaborators AS SELECT * FROM workspace_users;
GRANT ALL ON workspace_collaborators TO authenticated;
GRANT ALL ON workspace_collaborators TO service_role;

-- Then run ADD_PINNED_PAPERS.sql
```

### 3️⃣ Restart Backend
```bash
cd /Users/vidharia/Documents/Projects/capstone/researchAI/backend
npm run dev
```

### 4️⃣ Test Visual Analytics
1. Open any workspace
2. Click "Visual Analytics" tab
3. Should see charts loading (not placeholders)

### 5️⃣ Test Pinned Papers
1. Click "Papers" tab
2. Click "Pin Paper" button
3. Fill form → Save → Should appear in list

### 6️⃣ Test Humanizer
1. Go to Humanizer page
2. Paste text → Click "Humanize"
3. Check browser console for detailed logs

## ✅ Success Indicators
- No 403 Forbidden errors
- Charts display real data
- Papers can be pinned/unpinned
- Humanizer processes text

## ❌ If Still Broken
Check backend logs for:
```
ERROR: relation "workspace_users" does not exist
ERROR: relation "workspace_collaborators" does not exist
```

If you see these → SQL migration didn't run correctly

## Files You Modified
- ✅ `FIX_TABLE_NAMING_ISSUE.sql` - Created
- ✅ `ADD_PINNED_PAPERS.sql` - Created earlier
- ✅ `backend/src/routes/analytics.js` - Fixed 6 instances
- ✅ `backend/src/routes/pinnedPapers.js` - Fixed 4 instances

## What Changed
**Before**: Backend queries `workspace_users` → Table doesn't exist → Everything fails  
**After**: SQL view makes `workspace_users` → point to `workspace_collaborators` → Everything works
