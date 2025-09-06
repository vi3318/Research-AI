# 🚀 Complete Setup Guide for ResearchAI

## 🔧 **STEP 1: Install Dependencies**

### Backend
```bash
cd backend
npm install
```

### Frontend  
```bash
cd frontend
npm install
```

## 🔑 **STEP 2: Get All Required API Keys**

### **1. Clerk Authentication (Required)**
1. Go to [clerk.com](https://clerk.com) 
2. Sign up and create a new application
3. Choose "Email" as the authentication method
4. Go to **API Keys** in the dashboard
5. Copy these keys:
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)

### **2. Supabase Database (Required)**
1. Go to [supabase.com](https://supabase.com)
2. Sign up and create a new project
3. Wait for project to initialize (2-3 minutes)
4. Go to **Settings** → **API**
5. Copy these keys:
   - `SUPABASE_URL` (your project URL)
   - `SUPABASE_ANON_KEY` (public anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service role key - keep private!)

### **3. Google Gemini (Required)**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy `GEMINI_API_KEY`

### **4. Optional Services (Recommended)**
- **Unpaywall Email**: Just use your email address
- **GROBID**: Leave empty (we'll use a public instance)
- **Redis**: Use default localhost settings

## 📝 **STEP 3: Create Environment Files**

### **Backend `.env`** (create in `/backend/.env`)
```env
# Server Configuration
PORT=3000
CORS_ORIGIN=*

# API Keys
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication & Database
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Redis Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600

# Optional Services
GROBID_URL=https://cloud.science-miner.com/grobid
UNPAYWALL_EMAIL=your-email@example.com

# Research Worker & Backpressure
ENABLE_RESEARCH_WORKER=true
RESEARCH_WORKER_CONCURRENCY=1
RESEARCH_MAX_RESULTS=8

# Sources
SCHOLAR_ENABLED=true
DEFAULT_SOURCES=scholar,arxiv,pubmed,openalex

# Hybrid Fusion Weights
HYBRID_W_BM25=0.5
HYBRID_W_EMBED=0.5

# Debug Configuration
DEBUG=researchai:*
```

### **Frontend `.env`** (create in `/frontend/.env`)
```env
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key-here
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🗄️ **STEP 4: Setup Database**

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the sidebar
3. Copy the contents of `backend/src/config/database-schema.sql`
4. Paste and **Run** the SQL to create all tables

## 🚀 **STEP 5: Start the Application**

### **Terminal 1: Start Redis (if not already running)**
```bash
# macOS with Homebrew
brew services start redis

# or run directly
redis-server
```

### **Terminal 2: Start Backend API**
```bash
cd backend
npm run dev
```

### **Terminal 3: Start Background Worker**  
```bash
cd backend
npm run worker
```

### **Terminal 4: Start Frontend**
```bash
cd frontend  
npm run dev
```

## 🔍 **STEP 6: Test the Setup**

1. **Open** http://localhost:5173
2. **Sign up/Login** with Clerk
3. **Create a research session**
4. **Type**: "machine learning for healthcare"
5. **Click Research** and wait for results

## 🎯 **COMPLETE APP FLOW & WHAT YOU'LL SEE**

### **1. Landing Page (Not Logged In)**
- **What you see**: Clean landing page with "Welcome to ResearchAI"
- **Action**: Click "Get Started" to sign in

### **2. Sign Up/Login**
- **What you see**: Clerk authentication modal
- **Action**: Create account with email/password
- **Backend**: User synced to Supabase database

### **3. Main Research Interface**
- **What you see**: 
  - Left sidebar: "Research Sessions" (empty initially)
  - Main area: "Start Your Research Journey"
  - Top nav: Research Assistant, Research Jobs, etc.
- **Action**: Click "Create Research Session"

### **4. Research Session Created**
- **What you see**:
  - New session appears in sidebar
  - Chat interface with tabs: Chat | Papers | Analysis
  - Text input: "Ask a research question or search for papers..."
- **Action**: Type research query

### **5. Research Query Processing**
**Example**: Type "graph neural networks for drug discovery"

**Backend Flow:**
1. **Enhanced Scraping Service** searches:
   - Google Scholar (with Playwright)
   - arXiv API
   - PubMed API  
   - OpenAlex API
2. **Enrichment Process**:
   - DOI lookup via Crossref
   - Open access PDFs via Unpaywall
   - Citation counts via OpenAlex
   - PDF content extraction
3. **Deduplication & Ranking**:
   - Remove duplicates by DOI/title
   - Score by relevance + quality
4. **AI Analysis**:
   - Gemini generates summary
   - Papers added to session context
5. **Gap Analysis** (if enabled):
   - Extract themes and methodologies
   - Identify research gaps
   - Generate opportunities

**Frontend Updates:**
- **Chat tab**: Shows AI summary of findings
- **Papers tab**: Grid of discovered papers with metadata
- **Analysis tab**: Interactive visualizations (if generated)

### **6. Paper Interaction**
- **What you see**: Grid of paper cards with:
  - Title, authors, abstract
  - Source badges (Scholar, arXiv, etc.)
  - Citation count, relevance score
  - "Ask" button
- **Action**: Click "Ask" on any paper

### **7. Paper Q&A**
- **What you see**: Modal asking "Ask a question about this paper:"
- **Example input**: "What are the limitations of this approach?"
- **Backend**: 
  - Retrieves paper from session context
  - Uses PDF content + abstract for analysis
  - Gemini generates detailed answer
- **Result**: Detailed answer appears in chat

### **8. Research Gap Analysis**
- **Action**: Click "Analysis" tab
- **What you see**:
  - Theme distribution pie chart
  - Methodology bar chart
  - Gap impact vs difficulty scatter plot
  - Research opportunities cards
  - Network visualization
- **Backend**: 
  - Analyzes all papers in session
  - Uses NLP + Gemini for gap identification
  - Generates visualization data

### **9. Session Persistence**
- **What happens**: All data saved to Supabase
- **On return**: Previous sessions and context preserved
- **Multi-session**: Can have multiple research topics

## 🐛 **TROUBLESHOOTING**

### **Common Issues:**

1. **"getToken is not a function"** ✅ FIXED
   - Updated to use `useAuth()` hook correctly

2. **"ClerkExpressRequireAuth is not a function"** ✅ FIXED
   - Updated backend middleware imports

3. **Database connection errors**
   - Check Supabase URL and keys
   - Ensure database schema is created

4. **Redis connection errors**
   - Start Redis server: `brew services start redis`

5. **Scholar scraping blocked**
   - Set `SCHOLAR_ENABLED=false` in .env
   - Will still work with arXiv, PubMed, OpenAlex

6. **Rate limiting**
   - Reduce `RESEARCH_MAX_RESULTS` to 5
   - Add delays between requests

## 🎉 **SUCCESS INDICATORS**

✅ **Frontend loads** at http://localhost:5173
✅ **Can sign in** with Clerk
✅ **Can create session** 
✅ **Research query returns papers**
✅ **Can ask questions about papers**
✅ **Gap analysis generates visualizations**
✅ **Sessions persist** across browser refreshes

## 🔄 **Next Steps After Testing**

1. **User Study**: Recruit graduate students
2. **Performance Optimization**: Handle larger paper sets
3. **Advanced Features**: LangGraph integration
4. **Research Paper**: Document findings and user studies

Your app is now ready for comprehensive testing! 🚀