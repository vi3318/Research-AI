# RMRI Backend Foundation - Implementation Guide

## Overview

This implementation provides the complete backend foundation for the **RMRI (Recursive Multi-Agent Research Intelligence)** workflow as described in the capstone paper. The system supports multi-agent research orchestration with file-based context storage and comprehensive tracking.

## Architecture Components

### 1. Database Schema (`migrations/001_rmri_foundation.sql`)

#### Tables Created:

- **`rmri_runs`** - Master table tracking research runs
  - Stores query, status, configuration, and execution metadata
  - Statuses: `initializing`, `planning`, `executing`, `synthesizing`, `completed`, `failed`, `cancelled`

- **`rmri_agents`** - Individual agent instances within runs
  - Supports agent types: `planner`, `searcher`, `analyzer`, `synthesizer`, `critic`, `validator`
  - Tracks parent-child relationships for recursive agent spawning
  - Records execution time and depth level

- **`contexts`** - Metadata for context files in Supabase Storage
  - Points to actual data stored in Supabase Storage bucket
  - Supports versioning and active/inactive states
  - Includes summaries for quick access

- **`context_versions`** - Complete version history of context modifications
  - Tracks append vs overwrite operations
  - Stores diffs and operation metadata

- **`rmri_results`** - Outputs from agent executions
  - Result types: `search_results`, `analysis`, `synthesis`, `hypothesis`, `critique`, `final_report`
  - Includes confidence scores and source citations
  - Supports marking final vs intermediate results

- **`rmri_logs`** - Detailed execution logs
  - Log levels: `debug`, `info`, `warning`, `error`, `critical`
  - Indexed by timestamp for efficient querying

- **`rmri_feedback`** - User feedback for continuous improvement
  - Rating system (1-5 stars)
  - Categorized feedback types

#### Security Features:

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own runs and related data
- Supabase Auth JWT validation required
- Automatic timestamp tracking with triggers

### 2. Context Storage Service (`services/contextStorage.js`)

#### Key Features:

- **File-based storage** using Supabase Storage bucket `rmri-contexts`
- **Append and Overwrite** modes for context updates
- **Automatic versioning** of all context modifications
- **Smart summarization** for quick context previews
- **Size limits** (10MB per context) with validation
- **Cleanup utilities** for old/inactive contexts

#### Main Methods:

```javascript
// Write context data
await contextStorage.writeContext(runId, agentId, contextKey, data, 'append|overwrite', metadata)

// Read context data
await contextStorage.readContext(runId, agentId, contextKey, summaryOnly, version)

// List available contexts
await contextStorage.listAvailableContexts(runId, agentId)

// Get version history
await contextStorage.getContextVersions(contextId)

// Cleanup old contexts
await contextStorage.cleanupOldContexts(runId, daysOld)
```

#### Storage Structure:

```
rmri-contexts/
  ├── {runId}/
  │   ├── {agentId}/
  │   │   ├── search_results_v1_1698765432.json
  │   │   ├── analysis_v1_1698765433.json
  │   │   └── synthesis_v2_1698765434.json
```

### 3. API Routes (`routes/rmri.js`)

#### Endpoints:

##### `POST /api/rmri/start`
Start a new RMRI research run

**Request:**
```json
{
  "query": "What are the latest advances in quantum computing?",
  "config": {
    "maxDepth": 3,
    "maxAgents": 20,
    "timeout": 300000,
    "confidenceThreshold": 0.7,
    "enableCritic": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "query": "What are the latest advances in quantum computing?",
    "status": "initializing",
    "config": {...},
    "startedAt": "2025-11-01T12:00:00Z"
  }
}
```

##### `GET /api/rmri/:id/status`
Get run status and progress

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "query": "...",
    "status": "executing",
    "progress": 65,
    "agents": {
      "total": 10,
      "pending": 2,
      "active": 1,
      "completed": 6,
      "failed": 1,
      "byType": {
        "searcher": { "total": 4, "completed": 3 },
        "analyzer": { "total": 3, "completed": 2 }
      }
    },
    "elapsedMs": 45000,
    "recentLogs": [...]
  }
}
```

##### `GET /api/rmri/:id/results`
Get research results

**Query params:** `type`, `finalOnly`

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "status": "completed",
    "resultsCount": 5,
    "results": [
      {
        "id": "uuid",
        "result_type": "final_report",
        "content": {...},
        "confidence_score": 0.85,
        "sources": [...],
        "is_final": true,
        "created_at": "..."
      }
    ]
  }
}
```

##### `POST /api/rmri/writecontext`
Write context data

**Request:**
```json
{
  "runId": "uuid",
  "agentId": "uuid",
  "contextKey": "search_results",
  "data": {...},
  "mode": "append",
  "metadata": {}
}
```

##### `POST /api/rmri/readcontext`
Read context data

**Request:**
```json
{
  "runId": "uuid",
  "agentId": "uuid",
  "contextKey": "search_results",
  "summaryOnly": false,
  "version": 1
}
```

##### `GET /api/rmri/listcontexts?runId={uuid}&agentId={uuid}`
List all contexts for a run

##### `GET /api/rmri/:id/agents`
Get all agents in a run

##### `GET /api/rmri/:id/logs?level=info&limit=100&offset=0`
Get execution logs

## Setup Instructions

### 1. Database Migration

Run the SQL migration in your Supabase dashboard:

```bash
# Copy the contents of migrations/001_rmri_foundation.sql
# Paste into Supabase SQL Editor and execute
```

### 2. Create Storage Bucket

In Supabase dashboard:
1. Go to Storage
2. Create new bucket named `rmri-contexts`
3. Set public access to `false`
4. Configure RLS policies as shown in migration file

### 3. Environment Variables

Ensure these are set in your `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 4. Start Backend

```bash
cd backend
npm install
npm start
```

## Authentication

All RMRI endpoints require Supabase Auth JWT token:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_SUPABASE_JWT_TOKEN'
}
```

## Usage Example

```javascript
// 1. Start RMRI run
const startResponse = await fetch('http://localhost:3000/api/rmri/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'Latest quantum computing advances',
    config: { maxDepth: 3 }
  })
});

const { data: { runId } } = await startResponse.json();

// 2. Check status
const statusResponse = await fetch(`http://localhost:3000/api/rmri/${runId}/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Write context (from agent)
await fetch('http://localhost:3000/api/rmri/writecontext', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    runId,
    agentId: 'agent-uuid',
    contextKey: 'search_results',
    data: { papers: [...] },
    mode: 'overwrite'
  })
});

// 4. Get final results
const resultsResponse = await fetch(
  `http://localhost:3000/api/rmri/${runId}/results?finalOnly=true`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
```

## Next Steps

The foundation is now complete. Next prompt should implement:

1. **Agent Orchestrator** - Manages agent lifecycle
2. **Planner Agent** - Creates research execution plans
3. **Searcher Agent** - Performs literature searches
4. **Analyzer Agent** - Analyzes papers and extracts insights
5. **Synthesizer Agent** - Combines findings into coherent reports
6. **Critic Agent** - Validates results and identifies gaps
7. **Validator Agent** - Final quality checks

## Key Design Decisions

### Why Supabase Storage?
- **Scalable**: Handles large context files efficiently
- **Secure**: Integrates with Supabase Auth seamlessly
- **Cost-effective**: Pay only for what you store
- **Built-in**: No additional infrastructure needed

### Why File-based Contexts?
- **Size flexibility**: Support large agent outputs
- **Versioning**: Track all modifications
- **Performance**: Database stores only metadata
- **Separation**: Clean architecture with clear boundaries

### Why Modular Design?
- **Testability**: Each component can be tested independently
- **Scalability**: Easy to add new agent types
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Simple to add features

## Monitoring & Debugging

### Check Run Status
```sql
SELECT * FROM rmri_runs WHERE user_id = 'your-user-id' ORDER BY created_at DESC;
```

### View Agent Execution
```sql
SELECT agent_type, status, execution_time_ms 
FROM rmri_agents 
WHERE run_id = 'run-uuid' 
ORDER BY created_at;
```

### Monitor Logs
```sql
SELECT log_level, message, timestamp 
FROM rmri_logs 
WHERE run_id = 'run-uuid' 
ORDER BY timestamp DESC 
LIMIT 50;
```

### Check Context Storage
```sql
SELECT context_key, size_bytes, version, summary 
FROM contexts 
WHERE run_id = 'run-uuid' AND is_active = true;
```

## Performance Considerations

- **Indexes**: Created on all foreign keys and commonly queried columns
- **RLS**: Optimized policies for user-scoped queries
- **Context Size**: 10MB limit prevents excessive memory usage
- **Cleanup**: Automated cleanup service for old contexts
- **Pagination**: Supported on logs and results endpoints

## Production Checklist

- [ ] Run database migration in production Supabase
- [ ] Create `rmri-contexts` storage bucket
- [ ] Configure RLS policies on storage bucket
- [ ] Set environment variables
- [ ] Test authentication flow
- [ ] Monitor initial runs for performance
- [ ] Set up automated cleanup cron job
- [ ] Configure backup policies for contexts
- [ ] Enable monitoring and alerting
- [ ] Document agent implementation guidelines

---

**Status**: ✅ Backend Foundation Complete - Ready for Agent Implementation
