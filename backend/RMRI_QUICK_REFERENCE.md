# RMRI Quick Reference Card

## 🚀 Quick Start Commands

```bash
# 1. Run migration
# Copy migrations/001_rmri_foundation.sql to Supabase SQL Editor and execute

# 2. Create storage bucket in Supabase Dashboard
# Storage → Create Bucket → "rmri-contexts" (private)

# 3. Start backend
npm start

# 4. Test (set TEST_SUPABASE_TOKEN first)
node test-rmri-foundation.js
```

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/rmri/start` | Start new RMRI run |
| GET | `/api/rmri/:id/status` | Get run status & progress |
| GET | `/api/rmri/:id/results` | Get research results |
| POST | `/api/rmri/writecontext` | Write context data |
| POST | `/api/rmri/readcontext` | Read context data |
| GET | `/api/rmri/listcontexts` | List available contexts |
| GET | `/api/rmri/:id/agents` | Get run agents |
| GET | `/api/rmri/:id/logs` | Get execution logs |

## 🔐 Authentication

All endpoints require JWT token:
```javascript
headers: {
  'Authorization': 'Bearer YOUR_SUPABASE_JWT_TOKEN'
}
```

## 💾 Database Tables

- **rmri_runs** - Run tracking
- **rmri_agents** - Agent instances
- **contexts** - Context metadata
- **context_versions** - Version history
- **rmri_results** - Execution results
- **rmri_logs** - Execution logs
- **rmri_feedback** - User feedback

## 📂 Context Storage Methods

```javascript
// Write context
await contextStorage.writeContext(
  runId, agentId, contextKey, data, 
  'append' | 'overwrite', metadata
);

// Read context
await contextStorage.readContext(
  runId, agentId, contextKey, 
  summaryOnly=false, version=null
);

// List contexts
await contextStorage.listAvailableContexts(runId, agentId);
```

## 🎯 Agent Types

- `planner` - Research planning
- `searcher` - Literature search
- `analyzer` - Paper analysis
- `synthesizer` - Result synthesis
- `critic` - Quality validation
- `validator` - Final checks

## 📊 Result Types

- `search_results` - Search outputs
- `analysis` - Analysis findings
- `synthesis` - Synthesized reports
- `hypothesis` - Generated hypotheses
- `critique` - Quality critiques
- `final_report` - Final deliverable

## 🔄 Run Statuses

- `initializing` - Starting up
- `planning` - Creating plan
- `executing` - Running agents
- `synthesizing` - Combining results
- `completed` - Finished
- `failed` - Error occurred
- `cancelled` - User cancelled

## 📝 Example Usage

```javascript
// Start run
const { data } = await fetch('/api/rmri/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    query: 'Your research query',
    config: { maxDepth: 3, maxAgents: 20 }
  })
});

const runId = data.data.runId;

// Write context
await fetch('/api/rmri/writecontext', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    runId, agentId, contextKey: 'results',
    data: {...}, mode: 'append'
  })
});

// Check status
const status = await fetch(`/api/rmri/${runId}/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get results
const results = await fetch(`/api/rmri/${runId}/results?finalOnly=true`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🛠️ Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=3000
```

## 📚 Documentation Files

- `RMRI_IMPLEMENTATION_GUIDE.md` - Full implementation guide
- `RMRI_DELIVERY_SUMMARY.md` - Delivery summary
- `test-rmri-foundation.js` - Test suite
- `migrations/001_rmri_foundation.sql` - Database schema

## 🔍 Monitoring Queries

```sql
-- Check run status
SELECT * FROM rmri_runs WHERE user_id = 'uuid' ORDER BY created_at DESC;

-- View agents
SELECT agent_type, status FROM rmri_agents WHERE run_id = 'uuid';

-- Recent logs
SELECT log_level, message FROM rmri_logs WHERE run_id = 'uuid' ORDER BY timestamp DESC LIMIT 20;

-- Active contexts
SELECT context_key, size_bytes FROM contexts WHERE run_id = 'uuid' AND is_active = true;
```

## ⚡ Performance Tips

- Use `summaryOnly=true` for quick context checks
- Paginate logs with `limit` and `offset`
- Filter results by `type` and `finalOnly`
- Clean up old contexts periodically
- Index on commonly queried fields

## 🐛 Common Issues

**401 Unauthorized**
→ Check JWT token validity

**403 Forbidden**
→ Verify user owns the run

**Context too large**
→ Max 10MB per context

**Storage bucket not found**
→ Create `rmri-contexts` bucket

## 📞 Support

Check implementation guide for detailed documentation.
