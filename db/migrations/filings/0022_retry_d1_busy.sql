-- C50: 209 filings failed with "D1_ERROR: Currently processing a long-running export" while the D44 backup test ran.
-- Infrastructure errors are temporary: re-queue them now (the loader also retries such failures every 6 hours).
DELETE FROM fin_load WHERE status = 'failed' AND substr(detail, 1, 7) = 'Error: ';
