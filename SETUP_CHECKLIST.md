# 🎯 Quick Setup Checklist - Follow These Steps

## ✅ Current Status

Based on the verification script, here's what's ready:

- ✅ **Redis is running**
- ✅ **All backend dependencies installed** (@huggingface/inference, cheerio, xml2js)
- ✅ **All backend files created**
- ✅ **Frontend file created**
- ✅ **SQL migration file ready**

## ⚠️ What You Need to Do

### Step 1: Get HuggingFace API Key (REQUIRED)

1. Visit: **https://huggingface.co/settings/tokens**
2. Click **"New token"**
3. Name it: `ResearchAI`
4. Type: **Read**
5. Click **"Generate token"**
6. Copy the token (starts with `hf_...`)

7. Open `backend/.env` and replace this line:
```env
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

With:
```env
HUGGINGFACE_API_KEY=hf_your_actual_token_here
```

**Save the file!**

---

### Step 2: Run SQL Migration in Supabase

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your **ResearchAI project**
3. Click **SQL Editor** in left sidebar
4. Click **"New query"**
5. Open the file: `CREATE_SEMANTIC_PAPERS_TABLE.sql` in your editor
6. **Copy ALL contents** (168 lines)
7. **Paste** into Supabase SQL Editor
8. Click **"Run"** button

**Expected output:**
```
Success. No rows returned
```

You should see a notice: `"Papers table created successfully with pgvector support!"`

---

### Step 3: Restart Backend Server

```bash
cd backend
npm run dev
```

**Expected console output:**
```
Server running on port 3000
✓ Connected to Supabase
[Embeddings] Using model: sentence-transformers/all-mpnet-base-v2
[Queue] Paper indexing queue initialized
```

**If you see warnings about HuggingFace API key**, go back to Step 1!

---

### Step 4: Test in Browser

1. Open your ResearchAI app: http://localhost:5173
2. Click **"Semantic Search"** in navigation
3. You should see the **new interface**:
   - Large search input
   - Stats dashboard (showing 0 papers initially)
   - Clean, modern design

4. Enter a test query:
```
machine learning for drug discovery
```

5. Click **"Search"** button

**What happens:**
- ⏳ Shows "Searching academic papers..." (10-15 seconds first time)
- 📚 Scrapes papers from ArXiv, PubMed, OpenAlex
- 🧠 Generates embeddings using HuggingFace
- 💾 Stores in Supabase with vector data
- ✅ Shows beautiful paper cards with Pin and View buttons

**Expected result:**
```
✅ Found 10 papers (including 10 newly indexed)
```

---

### Step 5: Verify Database

1. Go back to **Supabase Dashboard**
2. Click **Table Editor**
3. Find the **`papers`** table
4. You should see **10 rows** with data:
   - title
   - authors
   - abstract
   - year
   - source (arxiv, pubmed, openalex)
   - embedding (vector data)

---

### Step 6: Test Pin Functionality

1. In the search results, click **"Pin"** button on any paper
2. Select a workspace from dropdown
3. Click **"Pin"**

**Expected:**
```
✅ Pinned to [Workspace Name]!
```

4. Go to **Workspace** page → **Papers** tab
5. You should see the pinned paper there!

---

## 🐛 Troubleshooting

### Error: "HUGGINGFACE_API_KEY not set"
**Fix:** Complete Step 1 above. Make sure you saved the `.env` file and restarted the backend.

### Error: "relation 'papers' does not exist"
**Fix:** Run the SQL migration from Step 2.

### Error: "function search_papers_by_embedding does not exist"
**Fix:** Run the FULL SQL migration, not just part of it.

### Error: "connect ECONNREFUSED 127.0.0.1:6379"
**Fix:** Start Redis:
```bash
redis-server
```

### Papers not appearing in results
**Check:**
1. Open browser console (F12)
2. Look for errors
3. Check Network tab for failed requests
4. Verify backend logs show successful scraping

### Slow first search
**This is normal!** First search takes 10-15 seconds because:
- Scraping from 3 sources
- Generating embeddings (rate limited)
- Inserting into database

**Subsequent searches will be fast** (~1-2 seconds).

---

## 🎉 Success Indicators

You'll know it's working when you see:

✅ **Backend logs:**
```
[Semantic Search] Query: "machine learning for drug discovery"
[ArXiv] Found 10 papers
[PubMed] Found 10 papers
[OpenAlex] Found 10 papers
[Embeddings] Generating embeddings for 30 papers...
[Embeddings] Successfully generated 768-dimensional vector
[Database] Successfully inserted 30 papers
```

✅ **Frontend:**
- Beautiful paper cards appear
- Each card shows:
  - Title and authors
  - Abstract snippet
  - Source badge (colored by source)
  - Citation count
  - Similarity score percentage
  - Pin and View buttons
- Stats dashboard updates with totals

✅ **Supabase:**
- `papers` table has rows
- `embedding` column has vector data
- Each row has 768-dimensional vector

---

## 📊 Test Queries to Try

After your first search works, try these:

1. **Broad topics:**
   - "quantum computing applications"
   - "climate change machine learning"
   - "CRISPR gene editing"

2. **Specific techniques:**
   - "transformer architecture NLP"
   - "graph neural networks"
   - "federated learning privacy"

3. **Medical:**
   - "COVID-19 vaccine development"
   - "cancer immunotherapy"
   - "Alzheimer's disease detection"

---

## ⏱️ Time Estimates

- Step 1 (HuggingFace key): **2 minutes**
- Step 2 (SQL migration): **1 minute**
- Step 3 (Restart backend): **30 seconds**
- Step 4 (First search): **15 seconds**
- Step 5 (Verify database): **1 minute**
- Step 6 (Test pin): **30 seconds**

**Total: ~20 minutes**

---

## 🚀 You're Ready!

Once you complete these steps, you'll have:

✅ A fully functional semantic search system
✅ Papers automatically scraped from 3 academic sources
✅ Vector embeddings for intelligent similarity matching
✅ Pin functionality to save papers to workspaces
✅ Background job processing with Bull queue
✅ Fast subsequent searches using vector database

**Happy researching! 🎓**
