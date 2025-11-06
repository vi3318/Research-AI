# 🚀 Semantic Search Quick Start Guide

## Issues Fixed

### ✅ 1. Workspace Selector Not Showing
**Problem**: Even after logging in, workspaces weren't appearing in the dropdown.

**Solution**: 
- Added better logging to detect authentication issues
- Added automatic workspace reload when user logs in
- Added helpful message when no workspaces exist

**How to verify it's working**:
1. Open browser console (F12)
2. Go to Semantic Search page
3. Look for console logs: "Loading workspaces with token..."
4. You should see: "Workspaces loaded: [...]"

### ✅ 2. Manual JSON Pasting is Tedious
**Problem**: Copying and pasting JSON for every test is inconvenient.

**Solution**: Added **"Load from Pinned Papers"** button!

**How it works**:
- Click the green "Load from Pinned Papers" button
- Automatically fetches all papers you've pinned in the selected workspace
- Indexes them into semantic search
- No manual JSON required!

## Quick Test Workflow

### Step 1: Ensure Database is Ready
Run these SQL files in Supabase SQL Editor (in order):

1. **ADD_PINNED_PAPERS.sql** - Creates workspace_papers table
2. **CREATE_SEARCH_QUERIES_TABLE.sql** - Creates search analytics table

```sql
-- Just paste each file's contents into Supabase SQL Editor and run
```

### Step 2: Restart Backend
```bash
cd backend
npm run dev
```

### Step 3: Create Test Data (Easy Way!)

#### Option A: Use Research Jobs Auto-Pin (Recommended)
1. Go to **Research Jobs** page
2. Run a research job on any topic
3. When papers appear, select a workspace from dropdown
4. Click **"Pin to Workspace"** on papers you like
5. Papers are now saved!

#### Option B: Manually Add a Paper
1. Go to **Workspace** page → **Papers** tab
2. Click **"Pin Paper"** button
3. Fill in paper details:
   - Title: "AI in Healthcare"
   - Authors: John Doe, Jane Smith
   - Year: 2024
   - Abstract: "This paper explores..."
   - Journal: "Nature Medicine"
4. Click Save

### Step 4: Test Semantic Search

1. Go to **Semantic Search** page
2. Select your workspace from dropdown (you should see it now!)
3. Click **"Load from Pinned Papers"** button
4. Wait for success message: "✅ Successfully indexed X papers from your workspace!"
5. Enter a search query related to your papers
6. Click **Search**
7. See relevant results!
8. Click **Pin** to save interesting results back to workspace

## Features Available

### 🎯 Quick Actions
- **Load from Pinned Papers** - One-click indexing from your workspace
- **View Indexed (X)** - See all currently indexed papers
- **Clear Index** - Remove all indexed papers

### 🔍 Search Features
- **Semantic Search** - Meaning-based search
- **Conceptual Search** - Concept extraction
- **Contextual Search** - Context-aware results

### 🎛️ Filters
- **Year Filter** - Filter by publication year
- **Author Filter** - Filter by author name

### 📌 Pin to Workspace
- Pin search results to any workspace
- Auto-pin from Research Jobs
- Manage pins in Workspace page

## Troubleshooting

### Workspace selector shows "Please log in and create a workspace"

**Check**:
1. Are you logged in? Look for user icon in top right
2. Do you have a workspace? Go to Workspaces page and create one

**Console check**:
```
// Open console (F12), you should see:
"Loading workspaces with token: ey..."
"Workspaces loaded: [{id: '...', name: '...'}]"
```

**If you see "No auth token found"**:
- Click Login and sign in again
- Refresh the page

### "Load from Pinned Papers" button disabled

**Reason**: No workspace selected

**Fix**:
1. Make sure workspace dropdown shows a workspace
2. If dropdown is empty, create a workspace first
3. Refresh the page

### No papers found when loading

**This means**:
- Your selected workspace has no pinned papers yet
- Go pin some papers first (see Step 3 above)

### Papers not appearing in search results

**Check**:
1. Did "Load from Pinned Papers" show success message?
2. Click "View Indexed (X)" - do you see papers?
3. Is your search query related to the papers you indexed?

**Try**:
- Use broader search terms
- Check paper titles/abstracts match your query
- Try "Conceptual" or "Contextual" search modes

## Advanced Usage

### Manual JSON Indexing (Still Available)

If you want to index custom papers:

```json
[
  {
    "title": "Deep Learning for Medical Diagnosis",
    "authors": ["John Doe", "Jane Smith"],
    "year": 2024,
    "abstract": "This paper presents a novel approach to medical diagnosis using deep learning...",
    "publication": "Nature Medicine",
    "citationCount": 150,
    "keywords": ["deep learning", "medical AI", "diagnosis"],
    "fullText": "Full paper content here...",
    "url": "https://example.com/paper"
  }
]
```

Paste this into the textarea and click **Index**.

### Query Logging

All your searches are automatically logged to the `search_queries` table for analytics:
- Query text
- Search mode used
- Number of results
- Filters applied
- Execution time

### Filters

After indexing papers, you'll see:
- **Year dropdown** - All publication years from indexed papers
- **Author dropdown** - All authors from indexed papers

Apply filters before searching to narrow results.

## System Architecture

```
User Action: Click "Load from Pinned Papers"
     ↓
Frontend: Fetch /api/workspaces/:id/papers
     ↓
Backend: Query workspace_papers table
     ↓
Frontend: Transform to semantic index format
     ↓
Frontend: POST /api/semantic/index
     ↓
Backend: Generate embeddings (Gemini)
     ↓
Backend: Store in vector store + BM25 index
     ↓
User: Search with natural language
     ↓
Backend: Hybrid search (semantic + keyword)
     ↓
Frontend: Display ranked results
```

## Next Steps

1. ✅ Run database migrations (ADD_PINNED_PAPERS.sql, CREATE_SEARCH_QUERIES_TABLE.sql)
2. ✅ Restart backend server
3. ✅ Log in to the app
4. ✅ Create a workspace if you don't have one
5. ✅ Pin some papers (via Research Jobs or manual entry)
6. ✅ Go to Semantic Search
7. ✅ Click "Load from Pinned Papers"
8. ✅ Start searching!

## Success Indicators

✅ Workspace dropdown shows your workspaces
✅ "Load from Pinned Papers" button is enabled (green)
✅ Success toast: "Successfully indexed X papers from your workspace!"
✅ "View Indexed (X)" shows correct count
✅ Search returns relevant results
✅ Pin button adds papers to workspace

## Support

If you encounter issues:

1. **Check browser console** (F12) for errors
2. **Check backend logs** for API errors
3. **Verify database migrations** ran successfully
4. **Confirm authentication** - localStorage has 'authToken'
5. **Test workspace API** - Visit `/api/workspaces` in browser

Common console commands to debug:
```javascript
// Check auth token
localStorage.getItem('authToken')

// Check workspaces
fetch('/api/workspaces', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('authToken') }
}).then(r => r.json()).then(console.log)
```

---

**You're all set!** 🎉 The tedious JSON pasting is now optional - just use "Load from Pinned Papers" for a seamless experience.
