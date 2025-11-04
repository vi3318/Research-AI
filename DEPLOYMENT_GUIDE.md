# 🚀 ResearchAI - Complete Deployment & Integration Guide

## 📦 What's Included

This integration package includes:
- ✅ Complete backend service layer (LLM, humanizer, papers, charts, job queue)
- ✅ Realtime document collaboration with Y.js support
- ✅ Auto-save with revision history and diff tracking
- ✅ Rate limiting and background job processing
- ✅ Comprehensive test suites
- ✅ Docker deployment setup
- ✅ Frontend integration examples

---

## 🎯 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Additional packages (if not already installed)
npm install bull chartjs-node-canvas redis axios jsondiffpatch y-websocket
```

### 2. Setup Environment

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit .env with your values
nano backend/.env
```

**Required Environment Variables:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (local or hosted)
REDIS_URL=redis://localhost:6379

# At least ONE LLM provider (or use sandbox mode)
CEREBRAS_API_KEY=your-key  # Recommended
# OR
HUGGINGFACE_API_KEY=your-key
# OR use sandbox mode (no key needed)

# Optional: Rate limits (defaults shown)
RATE_LIMIT_HUMANIZE_POINTS=20
RATE_LIMIT_CHART_POINTS=10
```

### 3. Setup Database

```bash
# Run the complete migration in Supabase SQL Editor
cat COMPLETE_DATABASE_MIGRATION.sql | pbcopy

# Then paste into Supabase Dashboard > SQL Editor > New Query > Run
```

**Or manually create storage buckets:**

Go to Supabase Dashboard > Storage:
- Create bucket: `chart-exports` (public)
- Create bucket: `paper-pdfs` (private)

### 4. Start Services

#### Option A: Local Development

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Backend
cd backend
npm start

# Terminal 3: Start Worker (optional - for background jobs)
npm run worker
```

#### Option B: Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# With debugging tools (Redis GUI, Bull Board)
docker-compose --profile debug up -d
```

### 5. Run Tests

```bash
# Get a JWT token from your app
export TEST_JWT_TOKEN="your-jwt-token-here"
export TEST_WORKSPACE_ID="your-workspace-id"

# Run integration tests
npm test -- tests/integration.test.js

# Or run service tests
npm test -- tests/services.test.js
```

---

## 📋 Database Migration Checklist

- [ ] Run `COMPLETE_DATABASE_MIGRATION.sql` in Supabase
- [ ] Create storage buckets (`chart-exports`, `paper-pdfs`)
- [ ] Verify RLS policies are enabled
- [ ] Test connection: `psql $SUPABASE_URL -c "SELECT * FROM document_revisions LIMIT 1;"`

**What the migration creates:**

1. **document_revisions** - Version history with diff support
2. **papers** - Paper metadata cache (7-day TTL)
3. **chart_exports** - Generated charts storage
4. **humanizer_logs** - AI usage tracking
5. **Helper functions** - `create_revision_snapshot()`, `cleanup_old_revisions()`

---

## 🔌 Frontend Integration

### Step 1: Install Frontend Dependencies

```bash
cd frontend
npm install y-websocket y-protocols lodash @types/lodash
```

### Step 2: Update Environment

```bash
# frontend/.env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_YJS_WEBSOCKET_URL=ws://localhost:1234
```

### Step 3: Implement Hooks

Copy the hooks from `FRONTEND_INTEGRATION_GUIDE.md`:

- `useDocumentRealtime.ts` - Supabase realtime subscriptions
- `useAutosave.ts` - Auto-save with debouncing
- `useHumanizer.ts` - Text humanization
- `useCharts.ts` - Chart generation
- `usePins.ts` - Paper pinning

### Step 4: Update DocEditor Component

Replace your existing `DocEditorProduction.tsx` with the integrated version from the guide:

```typescript
// Key integrations:
- Y.js CRDT for collaborative editing
- Supabase Realtime for presence & updates
- Auto-save every 3 seconds
- Revision history viewer
- Humanizer toolbar button
```

**See:** `FRONTEND_INTEGRATION_GUIDE.md` for complete code examples

---

## 🧪 Testing Workflow

### 1. Unit Tests (Service Layer)

```bash
npm test -- tests/services.test.js
```

**Tests:**
- LLM client provider selection
- Humanizer pre/post processing
- Paper ID detection (DOI, arXiv, OpenAlex)
- Quality scoring algorithm

### 2. Integration Tests (End-to-End)

```bash
# Set credentials
export TEST_JWT_TOKEN="eyJhbGc..."
export TEST_WORKSPACE_ID="123e4567-e89b-12d3-a456-426614174000"

# Run tests
npm test -- tests/integration.test.js
```

**Flow tested:**
1. Create document → Save content → Create revision → List revisions
2. Pin paper → Fetch pins → Unpin paper
3. Humanize text (sandbox mode) → Check quality score
4. Enqueue chart → Poll status → Retrieve chart
5. Invite collaborator → List documents
6. Rate limiting (send 25 requests, verify 429 responses)

### 3. Postman Collection

```bash
# Import collection
open ResearchAI_Postman_Collection.json

# Set variables:
- jwt_token: Your JWT from login
- workspace_id: Your test workspace
- base_url: http://localhost:3000

# Run collection
```

---

## 🐳 Docker Deployment

### Development

```bash
# Start all services
docker-compose up -d

# Services running:
- backend (port 3000)
- worker (background jobs)
- redis (port 6379)
- yjs-websocket (port 1234)
```

### Production

```bash
# Build for production
docker-compose -f docker-compose.yml build

# Start with optimizations
NODE_ENV=production docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=3
```

### Monitoring

```bash
# With debug tools (Redis GUI + Bull Board)
docker-compose --profile debug up -d

# Access tools:
- Redis Commander: http://localhost:8081
- Bull Board: http://localhost:3001
```

---

## 🔧 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  DocEditor + Hooks + Realtime Subscriptions             │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                 API Gateway (Express)                    │
│  /api/collaborative-documents                            │
│  /api/humanize                                           │
│  /api/workspaces/:id/charts                             │
│  /api/workspaces/:id/pins                               │
└────────────┬────────────────────────────────────────────┘
             │
             ├─────────────┬──────────────┬────────────────┐
             ▼             ▼              ▼                ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
      │Humanizer │  │  Paper   │  │  Chart   │  │   Job    │
      │ Service  │  │ Service  │  │ Service  │  │  Queue   │
      └──────────┘  └──────────┘  └──────────┘  └──────────┘
             │             │              │             │
             ├─────────────┴──────────────┴─────────────┘
             ▼
      ┌────────────────────────────────────────────────┐
      │     LLM Clients (Multi-provider Cascade)       │
      │  Cerebras → Gemini → HuggingFace → Sandbox    │
      └────────────────────────────────────────────────┘
             │
             ▼
      ┌────────────────────────────────────────────────┐
      │  External APIs + Storage + Database            │
      │  • OpenAlex, arXiv                             │
      │  • Supabase (DB + Storage + Realtime)          │
      │  • Redis (Rate Limiting + Job Queue)           │
      └────────────────────────────────────────────────┘
```

---

## 📊 API Endpoints Reference

### Documents

- `POST /api/collaborative-documents/create` - Create document
- `GET /api/collaborative-documents/:id` - Get document
- `PUT /api/collaborative-documents/:id` - Update content
- `POST /api/collaborative-documents/:id/create-revision` - Save revision
- `GET /api/collaborative-documents/:id/revisions` - List revisions

### Pins

- `POST /api/workspaces/:id/pins` - Pin paper
- `GET /api/workspaces/:id/pins` - Get pinned papers
- `DELETE /api/workspaces/:id/pins/:paperId` - Unpin

### Humanizer

- `POST /api/humanize` - Humanize text
  - Body: `{ text, workspace_id, provider? }`
  - Returns: `{ humanized_text, quality_score, provider, latency_ms }`

### Charts

- `POST /api/workspaces/:id/charts` - Enqueue chart job
  - Body: `{ type: 'citation_trend'|'keyword_network'|'venue_distribution' }`
  - Returns: `{ job_id, status: 'queued' }`
- `GET /api/jobs/:jobId/status?type=chart` - Check job status
- `GET /api/workspaces/:id/charts` - List charts

---

## 🔥 Troubleshooting

### "Redis connection refused"

```bash
# Check if Redis is running
redis-cli ping  # Should return: PONG

# Start Redis
redis-server

# Or use Docker
docker-compose up -d redis
```

### "Supabase authentication failed"

```bash
# Verify environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  $SUPABASE_URL/rest/v1/users
```

### "No LLM providers available"

```bash
# Use sandbox mode for testing (no API key needed)
curl -X POST http://localhost:3000/api/humanize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "test", "provider": "sandbox", "workspace_id": "xxx"}'

# Or set at least one API key:
export CEREBRAS_API_KEY="your-key"
export HUGGINGFACE_API_KEY="your-key"
```

### "Chart generation fails"

```bash
# Check workspace has papers
curl http://localhost:3000/api/workspaces/$WORKSPACE_ID/pins \
  -H "Authorization: Bearer $TOKEN"

# Check job queue
curl http://localhost:3000/api/jobs/stats \
  -H "Authorization: Bearer $TOKEN"

# View worker logs
docker-compose logs -f worker
```

### "Frontend can't connect to Realtime"

```bash
# Verify Supabase Realtime is enabled
# Dashboard > Settings > API > Realtime enabled

# Check subscription in browser console:
const channel = supabase.channel('test');
channel.subscribe((status) => console.log(status));
// Should log: "SUBSCRIBED"
```

---

## 📝 Frontend Changes Required

### ✅ Already Implemented in Backend
- Document CRUD endpoints
- Revision history endpoints
- Pinning endpoints
- Humanizer with quality scoring
- Chart generation with job queue
- Rate limiting middleware

### 🔨 Frontend TODO List

1. **Install dependencies**
   ```bash
   npm install y-websocket y-protocols lodash @types/lodash
   ```

2. **Create hooks** (copy from `FRONTEND_INTEGRATION_GUIDE.md`):
   - [ ] `useDocumentRealtime.ts`
   - [ ] `useAutosave.ts`
   - [ ] `useHumanizer.ts`
   - [ ] `useCharts.ts`
   - [ ] `usePins.ts`

3. **Update DocEditor component**:
   - [ ] Add Y.js provider setup
   - [ ] Integrate autosave hook
   - [ ] Add revision history UI
   - [ ] Add humanizer toolbar button
   - [ ] Subscribe to Supabase Realtime

4. **Update environment**:
   ```bash
   REACT_APP_API_URL=http://localhost:3000
   REACT_APP_YJS_WEBSOCKET_URL=ws://localhost:1234
   ```

5. **Test integration**:
   - [ ] Create document → Navigate to editor
   - [ ] Edit content → Auto-saves
   - [ ] Select text → Click "Humanize"
   - [ ] View revision history
   - [ ] See collaborators online

**Estimated Time:** 2-3 hours

---

## 🎓 Key Features Delivered

### Backend
- ✅ Multi-provider LLM (Cerebras → Gemini → HuggingFace → Sandbox)
- ✅ Humanizer with quality scoring (0-100)
- ✅ Paper metadata caching (7-day TTL)
- ✅ Server-side chart rendering (3 types)
- ✅ Background job queue (Bull + Redis)
- ✅ Rate limiting (Redis sliding window)
- ✅ Revision history with diff support

### Frontend Integration
- ✅ Supabase Realtime examples
- ✅ Y.js collaborative editing setup
- ✅ Auto-save with debouncing
- ✅ Revision history viewer
- ✅ Humanizer integration
- ✅ Chart generation flow

### DevOps
- ✅ Docker Compose setup
- ✅ Multi-stage Dockerfile
- ✅ Health checks
- ✅ Redis persistence
- ✅ Worker scaling

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `SERVICE_LAYER_COMPLETE.md` | Service implementation summary |
| `INTEGRATION_CHECKLIST.md` | Backend setup steps |
| `FRONTEND_INTEGRATION_GUIDE.md` | Frontend code examples |
| `ENV_CONFIG.md` | Environment variables reference |
| `COMPLETE_DATABASE_MIGRATION.sql` | Database schema |
| `docker-compose.yml` | Container orchestration |
| `ResearchAI_Postman_Collection.json` | API testing collection |
| `tests/integration.test.js` | End-to-end tests |
| `tests/services.test.js` | Unit tests |

---

## 🚢 Production Deployment

### Hosting Recommendations

- **Backend:** Railway, Render, Fly.io, AWS ECS
- **Redis:** Redis Cloud, AWS ElastiCache, Upstash
- **Database:** Supabase (hosted)
- **Y.js Server:** Deploy separately on VPS or serverless

### Environment Variables (Production)

```bash
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_ANON_KEY=xxx

# Redis (hosted)
REDIS_URL=redis://username:password@host:port

# LLM Providers
CEREBRAS_API_KEY=xxx
GEMINI_API_KEY=xxx

# Rate Limits (conservative for production)
RATE_LIMIT_HUMANIZE_POINTS=10
RATE_LIMIT_CHART_POINTS=5

# Monitoring
SENTRY_DSN=xxx  # Optional
LOG_LEVEL=warn
```

### Scaling Tips

- Run 2+ backend instances behind load balancer
- Scale workers independently: `docker-compose up -d --scale worker=5`
- Use Redis Cluster for high availability
- Enable Supabase connection pooling
- Monitor with Bull Board + Sentry

---

## ✨ What's Next?

1. **Frontend Integration** - Implement hooks and update DocEditor (2-3 hours)
2. **Testing** - Run integration tests with real data
3. **Deployment** - Deploy to production (Railway/Render)
4. **Monitoring** - Add Sentry, Bull Board, Redis monitoring
5. **Optimization** - Cache chart generation, tune rate limits

---

## 🆘 Support

**Documentation:**
- `FRONTEND_INTEGRATION_GUIDE.md` - Complete frontend examples
- `ENV_CONFIG.md` - All environment variables
- `INTEGRATION_CHECKLIST.md` - Step-by-step setup

**Testing:**
- Run tests: `npm test`
- Import Postman collection
- Check health: `curl http://localhost:3000/health`

**Common Issues:**
- See "Troubleshooting" section above
- Check Docker logs: `docker-compose logs -f`
- Verify environment: `printenv | grep SUPABASE`

---

**🎉 Ready to Deploy!**

All backend services are production-ready. Complete the frontend integration and you're ready to launch! 🚀
