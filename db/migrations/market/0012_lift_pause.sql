-- D130: compact code is live; lift the maintenance pause so the reload from the R2 cache starts.
DELETE FROM job_lock WHERE name = 'paused';
