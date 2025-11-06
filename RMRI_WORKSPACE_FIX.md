# RMRI Workspace Integration Fix

## Problem
RMRI system required `workspace_id` in backend validation but frontend wasn't providing it, causing "workspace_id is required in config" errors.

## Root Cause
- RMRI accessed via global route `/rmri` (not workspace-scoped)
- Backend requires workspace_id due to database foreign key constraint
- Frontend didn't have workspace context or selection

## Solution Implemented

### Frontend Changes (`RMRIStartPanel.jsx`)

#### 1. Auto-Fetch or Create Workspace
```javascript
const [workspaceId, setWorkspaceId] = useState(null);

useEffect(() => {
  const getWorkspace = async () => {
    // Try to get user's first workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
    } else {
      // Create an RMRI workspace if none exists
      const { data: newWorkspace } = await supabase
        .from('workspaces')
        .insert({
          name: 'RMRI Analysis Workspace',
          description: 'Workspace for RMRI research analysis',
          owner_id: user.id
        })
        .select()
        .single();

      if (newWorkspace) {
        setWorkspaceId(newWorkspace.id);
      }
    }
  };

  if (user) {
    getWorkspace();
  }
}, [user]);
```

#### 2. Send workspace_id in Request
```javascript
const startResponse = await axios.post('/api/rmri/start', {
  query,
  domains: selectedDomains,
  config: {
    workspace_id: workspaceId,  // ✅ Now included
    maxDepth: maxIterations,
    convergenceThreshold,
    minClusterSize: 2,
    maxGapsToRank: 20
  }
});
```

#### 3. Guard Against Missing Workspace
```javascript
const handleStartRun = async () => {
  if (!query.trim()) {
    setError('Please enter a research query');
    return;
  }

  if (papers.length === 0) {
    setError('Please upload at least one paper');
    return;
  }

  if (!workspaceId) {  // ✅ Check workspace ready
    setError('Setting up workspace...');
    return;
  }

  setStarting(true);
  // ... rest of logic
};
```

#### 4. Button Loading State
```javascript
<motion.button
  disabled={starting || !query.trim() || papers.length === 0 || !workspaceId}
>
  {starting ? (
    <span>Starting RMRI Analysis...</span>
  ) : !workspaceId ? (
    <span>Setting up workspace...</span>  // ✅ Shows loading
  ) : (
    <span>Start Analysis ({papers.length} papers)</span>
  )}
</motion.button>
```

## Behavior

### On Component Mount
1. Checks if user has any workspaces
2. Uses first workspace if available
3. Creates "RMRI Analysis Workspace" if none exist
4. Sets `workspaceId` state when ready

### When Starting Analysis
1. Validates query, papers, and workspace_id
2. Sends workspace_id in config to backend
3. Backend validates and creates run with workspace association
4. Run appears in workspace context

### User Experience
- Button disabled with "Setting up workspace..." while loading
- Once workspace ready, normal "Start Analysis" button appears
- No manual workspace selection needed
- Seamless auto-setup

## Database Requirement

Before testing, run `CREATE_RMRI_TABLES.sql` in Supabase:

```sql
-- This creates:
-- 1. rmri_runs table (with workspace_id FK)
-- 2. rmri_papers table
-- 3. rmri_iterations table
-- 4. RLS policies
-- 5. Auto-update triggers
```

## Testing Steps

1. **Setup Database**
   ```bash
   # In Supabase SQL Editor, run:
   CREATE_RMRI_TABLES.sql
   ```

2. **Test RMRI Flow**
   - Navigate to `/rmri`
   - Wait for "Setting up workspace..." → "Start Analysis"
   - Upload 5 AI healthcare papers
   - Enter research query
   - Click "Start Analysis"
   - Should create run with workspace_id

3. **Verify Database**
   ```sql
   SELECT id, workspace_id, query, status 
   FROM rmri_runs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Status Flow

✅ **Fixed:**
- workspace_id now sent from frontend
- Auto-workspace creation
- Proper loading states
- Status constraint (uses 'pending')

✅ **Ready to Test:**
- Upload papers
- Start analysis
- Background orchestration
- Multi-agent processing

⏳ **Pending:**
- Run CREATE_RMRI_TABLES.sql in Supabase
- Test with actual 5 AI healthcare papers
- Verify background processing
