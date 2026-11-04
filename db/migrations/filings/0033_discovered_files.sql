-- C56: the prefetch's every-minute discovery query (status='done' AND discovered=0) read ~226k rows per run, because
-- downloaded attachment FILES kept discovered=0. Only API lists are ever discovered; everything else is marked 1.
UPDATE fetch_job SET discovered = 1 WHERE discovered = 0 AND url NOT LIKE 'https://www.nseindia.com/%';
