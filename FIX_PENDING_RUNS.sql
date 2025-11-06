-- Fix pending runs that actually completed
-- This updates runs that have results but are stuck in 'pending' status

UPDATE rmri_runs
SET 
  status = 'completed',
  completed_at = NOW()
WHERE 
  status = 'pending'
  AND id IN (
    -- Find runs that have synthesis results (meaning they completed)
    SELECT DISTINCT run_id 
    FROM rmri_results 
    WHERE result_type = 'synthesis'
  );

-- Verify the update
SELECT 
  id,
  query,
  status,
  current_iteration,
  max_iterations,
  created_at,
  completed_at
FROM rmri_runs
ORDER BY created_at DESC
LIMIT 10;
