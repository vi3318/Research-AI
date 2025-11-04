# RMRI Multi-Agent Orchestration System - Complete Documentation

## 🎯 Overview

The RMRI (Recursive Multi-Agent Research Intelligence) orchestration system implements a three-tier hierarchical agent architecture with iterative refinement and convergence detection.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RMRI Orchestrator                          │
│            (Coordinates entire workflow + iterations)            │
└──────────────┬─────────────────────────────────────┬────────────┘
               │                                      │
        Iteration Loop (Max 4x)                 Convergence Check
               │                                      │
       ┌───────▼───────────────────────────────────────────┐
       │         Phase 1: Micro Agents (Parallel)          │
       │  • Process individual papers                      │
       │  • Extract contributions, limitations, gaps       │
       │  • Generate embeddings                            │
       │  • Confidence scoring                             │
       └───────┬───────────────────────────────────────────┘
               │
       ┌───────▼───────────────────────────────────────────┐
       │         Phase 2: Meso Agents (Clustering)         │
       │  • Cluster papers by theme (HDBSCAN/k-means)      │
       │  • Identify patterns within clusters              │
       │  • Synthesize thematic insights                   │
       │  • Extract cross-cluster gaps                     │
       └───────┬───────────────────────────────────────────┘
               │
       ┌───────▼───────────────────────────────────────────┐
       │         Phase 3: Meta Agent (Synthesis)           │
       │  • Cross-domain pattern recognition               │
       │  • Rank research gaps (importance × feasibility)  │
       │  • Identify research frontiers                    │
       │  • Generate actionable directions                 │
       │  • Check convergence                              │
       └───────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Micro Agent Worker (`workers/microAgentWorker.js`)

**Purpose:** Analyze individual research papers in depth

**Responsibilities:**
- Extract paper structure (sections, abstract, full text)
- Generate SciBERT-style embeddings for semantic understanding
- Perform LLM-based deep analysis of content
- Extract key contributions with confidence scores
- Identify stated and inferred limitations
- Detect research gaps and future work opportunities
- Assess methodology and reproducibility

**Queue:** `rmri-micro-agent`
**Concurrency:** 10 jobs in parallel
**Timeout:** 5 minutes per paper

**Outputs:**
```javascript
{
  paperId: string,
  title: string,
  contributions: [{ type, description, confidence }],
  limitations: [{ type, description, severity }],
  researchGaps: [{ type, description, priority }],
  methodology: { approach, techniques, datasets },
  embeddings: { title, abstract, combined },
  confidence: number
}
```

### 2. Meso Agent Worker (`workers/mesoAgentWorker.js`)

**Purpose:** Cluster micro outputs by thematic similarity

**Responsibilities:**
- Read all micro agent outputs for iteration
- Extract embeddings for clustering
- Perform k-means/HDBSCAN-style clustering
- Calculate cluster cohesion and centroids
- Identify common methodologies across papers
- Detect trends (increasing activity, high impact)
- Synthesize contributions and gaps by theme
- Identify cross-cluster patterns

**Queue:** `rmri-meso-agent`
**Concurrency:** 1 job per iteration
**Timeout:** 5 minutes

**Outputs:**
```javascript
{
  totalClusters: number,
  clusters: [{
    theme: { label, keywords, description },
    papers: [{ paperId, title, year }],
    keyContributions: [...],
    identifiedGaps: [...],
    commonMethodologies: [...],
    trends: [...],
    cohesion: number
  }],
  patterns: [{ type, description, confidence }],
  thematicGaps: [...]
}
```

### 3. Meta Agent Worker (`workers/metaAgentWorker.js`)

**Purpose:** Cross-domain synthesis and gap ranking

**Responsibilities:**
- Synthesize across all meso-level clusters
- Identify cross-domain patterns and overlaps
- Rank research gaps by:
  - Importance (0.35 weight)
  - Novelty (0.25 weight)
  - Feasibility (0.20 weight)
  - Impact (0.20 weight)
- Identify research frontiers (trending, cross-domain, methodological)
- Generate actionable research directions
- **Check convergence** with previous iteration
- Calculate overall confidence

**Queue:** `rmri-meta-agent`
**Concurrency:** 1 job per iteration
**Timeout:** 5 minutes

**Convergence Criteria:**
- Top 10 ranked gaps show ≥70% Jaccard similarity to previous iteration
- OR maximum 4 iterations reached

**Outputs:**
```javascript
{
  rankedGaps: [{ 
    gap, theme, scores, totalScore, ranking, confidence 
  }],
  crossDomainPatterns: [...],
  researchFrontiers: [...],
  recommendedDirections: [...],
  convergence: { 
    converged: boolean, 
    similarity: number, 
    reason: string 
  },
  shouldContinue: boolean
}
```

### 4. Orchestrator (`workers/orchestrator.js`)

**Purpose:** Coordinate all agents and manage iterations

**Responsibilities:**
- Start and manage RMRI runs
- Execute 3-phase workflow sequentially
- Wait for all micro jobs before meso
- Wait for meso before meta
- Implement iterative refinement (up to 4 iterations)
- Check convergence after each iteration
- Handle errors and job failures
- Manage run lifecycle and status updates
- Provide health checks and monitoring

**Key Methods:**
```javascript
orchestrator.startOrchestration(runId, papers, llmClient)
orchestrator.cancelOrchestration(runId)
orchestrator.getStatus(runId)
orchestrator.healthCheck()
orchestrator.getQueueStats()
```

## 🔄 Workflow Execution

### Step-by-Step Process

```javascript
// 1. User starts RMRI run
POST /api/rmri/start
{
  "query": "What are gaps in quantum computing research?",
  "config": { "maxDepth": 3 }
}
// Returns: { runId: "uuid" }

// 2. User provides papers and triggers execution
POST /api/rmri/:id/execute
{
  "papers": [...], // Array of paper objects
  "llmClient": "gemini"
}
// Starts orchestration asynchronously

// 3. Orchestrator begins iteration 1
// Phase 1: Launch micro agents for all papers (parallel)
// → Wait for all micro jobs to complete
// Phase 2: Launch meso agent for clustering
// → Wait for meso job to complete
// Phase 3: Launch meta agent for synthesis
// → Wait for meta job to complete
// → Check convergence

// 4. If not converged and iterations < 4:
//    Repeat iteration 2, 3, etc.

// 5. When converged or max iterations reached:
//    Finalize and store final results

// 6. User checks status
GET /api/rmri/:id/status
// Returns: progress, agents stats, logs

// 7. User retrieves final results
GET /api/rmri/:id/results?finalOnly=true
// Returns: ranked gaps, research directions
```

## 📊 Data Flow

### Context Storage Pattern

```
Iteration 1:
  micro_output_1_paper1 (runId, agent_id, context_key, data)
  micro_output_1_paper2
  ...
  meso_output_1 (clusters, patterns, gaps)
  meta_output_1 (ranked gaps, frontiers, convergence)

Iteration 2:
  micro_output_2_paper1
  ...
  meso_output_2
  meta_output_2 (checks similarity with meta_output_1)

Continue until converged...
```

## 🔧 Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Orchestrator Config

```javascript
const CONFIG = {
  MAX_ITERATIONS: 4,
  CONVERGENCE_THRESHOLD: 0.7,
  MICRO_CONCURRENCY: 10,
  MESO_BATCH_SIZE: 50,
  JOB_TIMEOUT: 300000, // 5 minutes
  ITERATION_DELAY: 5000 // 5 seconds
};
```

## 🚀 Deployment

### 1. Install Dependencies

```bash
cd backend
npm install bull redis @supabase/supabase-js
```

### 2. Start Redis

```bash
# macOS with Homebrew
brew services start redis

# Or with Docker
docker run -d -p 6379:6379 redis:alpine
```

### 3. Initialize Queues

The queues are automatically initialized when workers are imported. No manual setup needed.

### 4. Start Backend

```bash
npm start
```

The workers will automatically start processing jobs when they're added to the queues.

## 📡 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rmri/start` | POST | Create new RMRI run |
| `/api/rmri/:id/execute` | POST | Start orchestration |
| `/api/rmri/:id/status` | GET | Get run status |
| `/api/rmri/:id/results` | GET | Get results |
| `/api/rmri/:id/cancel` | POST | Cancel orchestration |
| `/api/rmri/health` | GET | System health check |
| `/api/rmri/queue-stats` | GET | Queue statistics |

## 📈 Monitoring

### Queue Health Check

```bash
curl http://localhost:3000/api/rmri/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "queues": {
      "micro": { "active": 5, "waiting": 0 },
      "meso": { "active": 0, "waiting": 0 },
      "meta": { "active": 0, "waiting": 0 }
    },
    "activeRuns": 2
  }
}
```

### Queue Statistics

```bash
curl http://localhost:3000/api/rmri/queue-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Monitoring

```sql
-- Check active runs
SELECT id, query, status, created_at 
FROM rmri_runs 
WHERE status IN ('executing', 'planning')
ORDER BY created_at DESC;

-- Agent breakdown by type
SELECT agent_type, status, COUNT(*) 
FROM rmri_agents 
WHERE run_id = 'your-run-id'
GROUP BY agent_type, status;

-- Recent logs
SELECT log_level, message, timestamp 
FROM rmri_logs 
WHERE run_id = 'your-run-id'
ORDER BY timestamp DESC 
LIMIT 50;
```

## 🎯 Performance Optimization

### Memory Efficiency

- **Streaming context reads**: Read summaries first, full data only when needed
- **Batch processing**: Micro agents limited to 10 concurrent
- **Job cleanup**: Old jobs removed automatically
- **Size limits**: 10MB max per context file

### Compute Efficiency

- **Parallel micro processing**: 10 papers analyzed simultaneously
- **Simplified clustering**: Efficient k-means instead of full HDBSCAN
- **Smart caching**: Embeddings reused across iterations
- **Early convergence**: Stops when gaps stabilize (saves iterations)

## 🐛 Troubleshooting

### Issue: Jobs stuck in waiting

**Cause:** Redis connection issues or worker not running

**Solution:**
```bash
# Check Redis
redis-cli ping

# Restart backend
npm restart
```

### Issue: Convergence never reached

**Cause:** Papers too diverse or threshold too strict

**Solution:** Adjust convergence threshold or max iterations in config

### Issue: Out of memory

**Cause:** Too many papers or large PDFs

**Solution:**
- Reduce `MICRO_CONCURRENCY`
- Batch large paper sets
- Increase server memory

### Issue: Jobs timing out

**Cause:** Papers too complex or LLM API slow

**Solution:**
- Increase `JOB_TIMEOUT`
- Use faster LLM model
- Reduce paper content size

## 🔐 Security Considerations

- ✅ JWT authentication on all endpoints
- ✅ Row-level security on database
- ✅ User ownership validation
- ✅ Rate limiting on job creation
- ✅ Input sanitization
- ✅ Private Redis connection

## 📝 Example Usage

```javascript
// Complete RMRI workflow example
const runRMRI = async () => {
  // 1. Start run
  const startRes = await fetch('/api/rmri/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'Gaps in quantum ML',
      config: { maxDepth: 3 }
    })
  });
  
  const { data: { runId } } = await startRes.json();
  
  // 2. Execute orchestration
  await fetch(`/api/rmri/${runId}/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      papers: [...], // Array of papers
      llmClient: 'gemini'
    })
  });
  
  // 3. Poll for status
  let status = 'executing';
  while (status === 'executing') {
    await sleep(5000);
    const statusRes = await fetch(`/api/rmri/${runId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusData = await statusRes.json();
    status = statusData.data.status;
    console.log(`Progress: ${statusData.data.progress}%`);
  }
  
  // 4. Get final results
  const resultsRes = await fetch(
    `/api/rmri/${runId}/results?finalOnly=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const results = await resultsRes.json();
  
  console.log('Top Research Gaps:', results.data.results[0].content.topGaps);
};
```

## 🎓 Research Paper Alignment

This implementation faithfully follows the RMRI architecture described in the capstone paper:

- ✅ **Three-tier hierarchy**: Micro → Meso → Meta
- ✅ **Iterative refinement**: Up to 4 iterations with convergence
- ✅ **Parallel micro processing**: Scalable paper analysis
- ✅ **Thematic clustering**: HDBSCAN-style grouping
- ✅ **Cross-domain synthesis**: Meta-level pattern recognition
- ✅ **Gap ranking**: Multi-criteria scoring system
- ✅ **Convergence detection**: Jaccard similarity threshold
- ✅ **File-based context storage**: Scalable data management

---

**Status:** ✅ **COMPLETE - Ready for Production Use**

All workers implemented, orchestrator functional, API integrated.
