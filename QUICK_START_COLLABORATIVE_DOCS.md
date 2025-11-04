# ⚡ QUICK START - Collaborative Documents

## 🚀 3-Step Setup (10 minutes)

### Step 1: Apply Database Schema (5 min)
```bash
# 1. Open Supabase Dashboard
https://app.supabase.com/project/YOUR_PROJECT/sql/new

# 2. Copy entire contents of:
COLLABORATIVE_DOCUMENTS_SCHEMA.sql

# 3. Paste in SQL Editor and click "Run"

# 4. Verify tables created:
# Go to Table Editor → Should see:
# - documents
# - document_content
# - document_collaborators
# - document_revisions
# - document_presence
```

### Step 2: Restart Backend (2 min)
```bash
cd backend

# Stop current server (Ctrl+C if running)

# Start server
node src/index.js

# Should see:
# ✓ Server running on port 3000
# ✓ /api/collab-docs routes loaded
```

### Step 3: Test It Out! (3 min)
```bash
# Frontend already running at: http://localhost:5174

# 1. Navigate to: Workspace tab
# 2. Click on any workspace (or create one)
# 3. Click "Documents" tab (NEW - first tab)
# 4. Click "IEEE Research Paper" button
# 5. Start typing!
```

---

## 📝 First Document Test

### Create IEEE Paper:
1. Click **"IEEE Research Paper"** (blue button)
2. Wait for editor to load (~2 seconds)
3. Edit title at top: "My First Research Paper"
4. Start typing in the Introduction section
5. Watch "Saved" indicator update every 2 seconds

### Test Formatting:
- **Bold**: Select text → Click Bold button
- **Headings**: Dropdown → Select "Heading 2"
- **Lists**: Click bullet or numbered list icon
- **Tables**: Click table icon → 3x3 table appears

### Test Sharing:
1. Click **"Share"** button (top-right)
2. Enter email: `colleague@example.com`
3. Choose role: **Editor**
4. Click "Add Collaborator"
5. *(Note: Real email lookup requires user in system)*

---

## ✅ Verification Checklist

After setup, verify these work:

- [ ] Documents tab appears in workspace
- [ ] IEEE Paper button creates document
- [ ] Editor loads with template
- [ ] Title editable
- [ ] Toolbar buttons work (bold, italic, etc.)
- [ ] Auto-save shows "Saved at HH:MM:SS"
- [ ] Blank Document also works
- [ ] Document list shows created docs
- [ ] Can navigate back to workspace
- [ ] Can reopen document from list

---

## 🐛 Common Issues

### "Table doesn't exist" error:
```bash
# Schema not applied yet
# → Go to Step 1 above
```

### "Route not found" /api/collab-docs:
```bash
# Backend not restarted
# → Go to Step 2 above
cd backend
node src/index.js
```

### Editor shows "Loading..." forever:
```bash
# Check browser console for errors
# Likely missing TipTap packages
cd frontend
npm install @tiptap/react @tiptap/starter-kit --legacy-peer-deps
```

### Documents tab not showing:
```bash
# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### Supabase connection error:
```bash
# Check .env files:
# frontend/.env → VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# backend/.env → SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Verify Supabase project is active (not paused)
```

---

## 📖 Full Documentation

For detailed docs, see:
- **`COLLABORATIVE_DOCS_IMPLEMENTATION_GUIDE.md`** - Complete technical guide
- **`WORKSPACE_UPGRADE_SUMMARY.md`** - Executive overview
- **`COLLABORATIVE_DOCUMENTS_SCHEMA.sql`** - Database schema with comments

---

## 🎯 Next Steps

After successful test:

1. **Create workspaces** for different research projects
2. **Invite team members** to collaborate
3. **Write papers** using IEEE template
4. **Customize** toolbar/templates as needed
5. **Export** documents (future feature)

---

## 💬 Support

If you encounter issues:
1. Check browser console (F12 → Console tab)
2. Check backend logs
3. Verify database schema applied
4. Review `COLLABORATIVE_DOCS_IMPLEMENTATION_GUIDE.md`

---

**You're ready to start collaborating!** 🚀
