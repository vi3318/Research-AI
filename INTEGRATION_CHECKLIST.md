# Integration Checklist - Service Layer Implementation

## ✅ Completed Components

### Services Created
- [x] `services/llmClients.js` - Extended with `humanizeText()` method
- [x] `services/humanizer.js` - Pre/post processing wrapper
- [x] `services/paperService.js` - OpenAlex/arXiv integration
- [x] `services/chartService.js` - Server-side chart rendering
- [x] `services/jobQueue.js` - Bull job queue management

### Middleware Created
- [x] `middleware/rateLimit.js` - Redis-based rate limiting

### Routes Created/Updated
- [x] `routes/charts.js` - Chart generation API
- [x] `routes/humanizer.js` - Updated with service layer

### Documentation
- [x] `ENV_CONFIG.md` - Comprehensive environment configuration
- [x] `tests/services.test.js` - Unit tests for service layer

---

## 🔧 Required Integration Steps

### 1. Install Dependencies

```bash
cd backend
npm install bull@^4.11.0 chartjs-node-canvas@^4.1.6 redis@^4.6.0 axios@^1.6.0
```

### 2. Update package.json

Add test script:
```json
{
  "scripts": {
    "test": "node tests/services.test.js",
    "worker": "node src/workers/index.js"
  }
}
```

### 3. Register Routes in app.js

Add to your main Express app file:

```javascript
// Import new routes
const chartsRouter = require('./routes/charts');

// Register routes
app.use('/api', chartsRouter);

// Verify humanizer route is registered
// app.use('/api', require('./routes/humanizer')); // Should already exist
```

### 4. Setup Environment Variables

Copy from `ENV_CONFIG.md`:

**Required:**
```bash
# Core
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REDIS_URL=redis://localhost:6379

# LLM (at least one required)
CEREBRAS_API_KEY=your-cerebras-key  # Primary
# OR
HUGGINGFACE_API_KEY=your-hf-key     # Fallback
# OR use sandbox mode (no key needed)
```

**Optional (for full features):**
```bash
GEMINI_API_KEY=your-gemini-key
RATE_LIMIT_HUMANIZE_POINTS=20
RATE_LIMIT_CHART_POINTS=10
```

### 5. Setup Supabase

**Storage Buckets:**
```sql
-- In Supabase Dashboard > Storage
CREATE BUCKET chart-exports (public: true)
CREATE BUCKET paper-pdfs (public: false)
```

**Database Tables:**
```bash
# Apply the SQL files:
psql $DATABASE_URL < MISSING_TABLES.sql
```

Or manually create:
```sql
-- Papers cache
CREATE TABLE papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT[],
  abstract TEXT,
  doi TEXT,
  arxiv_id TEXT,
  pdf_url TEXT,
  venue TEXT,
  year INTEGER,
  citation_count INTEGER,
  keywords TEXT[],
  url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_papers_doi ON papers(doi);
CREATE INDEX idx_papers_arxiv ON papers(arxiv_id);
```

### 6. Setup Redis

**Local Development:**
```bash
# Install Redis
brew install redis  # macOS
# OR
apt-get install redis-server  # Ubuntu

# Start Redis
redis-server
```

**Production:**
- Use Redis Cloud, AWS ElastiCache, or similar
- Update `REDIS_URL` environment variable

### 7. Start Background Workers (Optional)

If you want async job processing, create `src/workers/index.js`:

```javascript
const { jobQueueService } = require('../services/jobQueue');

console.log('🔄 Starting background workers...');
console.log('✅ Chart generation worker running');
console.log('✅ Paper metadata worker running');
console.log('✅ Batch humanize worker running');

// Workers are already started in jobQueue.js
// This file just keeps the process alive

process.on('SIGTERM', async () => {
  console.log('⏹️  Shutting down workers...');
  process.exit(0);
});
```

Then run in separate terminal:
```bash
npm run worker
```

---

## 🧪 Testing

### Run Unit Tests
```bash
npm test
```

Expected output:
```
🧪 Starting Service Layer Tests...

📝 LLM Clients Tests
  should detect available providers... ✅ PASS
  should humanize text in sandbox mode... ✅ PASS
  ...

📊 Test Summary
Total Tests:  15
✅ Passed:    15
❌ Failed:    0
```

### Test API Endpoints

**1. Humanize Text:**
```bash
curl -X POST http://localhost:3000/api/humanize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "text": "Utilize advanced methodologies to facilitate implementation.",
    "workspace_id": "your-workspace-id"
  }'
```

**2. Generate Chart:**
```bash
curl -X POST http://localhost:3000/api/workspaces/WORKSPACE_ID/charts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "type": "citation_trend",
    "params": {}
  }'
```

**3. Check Job Status:**
```bash
curl http://localhost:3000/api/jobs/JOB_ID/status?type=chart \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 🔍 Health Checks

Add to your app.js for monitoring:

```javascript
app.get('/api/health', async (req, res) => {
  const { humanizerService } = require('./services/humanizer');
  const { paperService } = require('./services/paperService');
  const { jobQueueService } = require('./services/jobQueue');
  const { healthCheck: rateLimitHealth } = require('./middleware/rateLimit');

  const health = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    services: {
      humanizer: await humanizerService.getHealth(),
      papers: await paperService.getHealth(),
      jobs: await jobQueueService.getAllQueueStats(),
      rateLimit: await rateLimitHealth()
    }
  };

  res.json(health);
});
```

---

## 📦 Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis instance running
- [ ] Supabase storage buckets created
- [ ] Database tables created
- [ ] Dependencies installed (`npm install`)
- [ ] Tests passing (`npm test`)
- [ ] Health endpoint returns 200
- [ ] Background workers started (if using async jobs)
- [ ] Rate limiting tested (429 responses work)
- [ ] CORS configured for frontend domain

---

## 🚨 Troubleshooting

### "Redis connection refused"
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not, start Redis:
redis-server
```

### "Supabase authentication failed"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check `SUPABASE_URL` format: `https://xxx.supabase.co`

### "No LLM providers available"
- Set at least one API key (CEREBRAS, HUGGINGFACE, or GEMINI)
- Or use sandbox mode (no key required)

### "Rate limit not working"
- Ensure Redis is running
- Check `REDIS_URL` environment variable
- Verify rate limit middleware is registered

### "Charts not generating"
- Check Supabase Storage bucket `chart-exports` exists
- Verify bucket is public (for image URLs to work)
- Check job queue stats: `GET /api/jobs/stats`

---

## 📝 Next Steps

1. **Install dependencies** (`npm install`)
2. **Setup environment variables** (copy from ENV_CONFIG.md)
3. **Start Redis** (`redis-server`)
4. **Run tests** (`npm test`)
5. **Start backend** (`npm start`)
6. **Test endpoints** (use curl or Postman)

---

## 🎯 Summary

**What's Complete:**
- ✅ 5 new services (LLM, humanizer, papers, charts, job queue)
- ✅ Rate limiting middleware
- ✅ Chart generation API
- ✅ Background job processing
- ✅ Unit tests
- ✅ Environment documentation

**What's Needed:**
- Install 4 npm packages
- Register 1 route in app.js
- Setup environment variables
- Create Supabase storage buckets
- Start Redis server

**Estimated Setup Time:** 15-20 minutes

---

For detailed configuration options, see **ENV_CONFIG.md**
