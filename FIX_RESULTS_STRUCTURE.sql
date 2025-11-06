-- Fix the results structure for the most recent completed run
-- This extracts the full rankedGaps from the meta agent output and stores it properly

-- First, let's see what we have
SELECT 
    r.id,
    r.run_id,
    r.result_type,
    jsonb_pretty(r.data) as current_data
FROM rmri_results r
WHERE r.result_type = 'synthesis'
ORDER BY r.created_at DESC
LIMIT 1;

-- If the above shows data.topGaps instead of data.rankedGaps, run this update:
-- (This will be run manually after checking the structure)

/*
UPDATE rmri_results
SET data = jsonb_set(
    data,
    '{rankedGaps}',
    COALESCE(data->'topGaps', '[]'::jsonb)
)
WHERE result_type = 'synthesis'
AND run_id = 'ce26c097-d948-4f4a-9ea8-903397626252'
AND data->>'rankedGaps' IS NULL;
*/
