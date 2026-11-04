-- P0 (audit 4 Nov, C56 follow-up): the recurring queries that read whole tables get the indexes they need. One-time
-- builds read each table once (filing ~70k, fin_value ~3M, fetch_job ~300k rows) and write the index entries.
-- remark pass: UPDATE filing ... WHERE source_url=? scanned every filing (only UNIQUE(kind, source_url) existed)
CREATE INDEX IF NOT EXISTS ix_filing_source_url ON filing (source_url);
-- versionPeriod: one company, period, period kind and basis (the PK only serves security_id here)
CREATE INDEX IF NOT EXISTS ix_fin_value_period ON fin_value (security_id, period_end, period_kind, basis, disclosed_at);
-- event / insider-trade / loader cursors: one kind from a job_id onwards, instead of the table tail or every 'done' row
CREATE INDEX IF NOT EXISTS ix_fetch_kind_job ON fetch_job (kind, job_id);
-- prefetch (every minute): NSE API jobs waiting or to retry, without reading the archive attachments queued for GitHub
CREATE INDEX IF NOT EXISTS ix_fetch_api_pending ON fetch_job (status, attempts, job_id) WHERE url LIKE 'https://www.nseindia.com/%';
-- loader retries (C43/C45/C48): a due time per retryable outcome and a try count, so retries stop after a cap
-- (exponential backoff 6 h, 12 h, 24 h ...; at most 8 tries) instead of every 6 hours forever
ALTER TABLE fin_load ADD COLUMN tries INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fin_load ADD COLUMN retry_after TEXT;
UPDATE fin_load SET retry_after = strftime('%Y-%m-%dT%H:%M:%fZ', at, '+6 hours')
  WHERE status = 'skipped' OR (status = 'review' AND substr(detail, 1, 12) = 'scale guard:') OR (status = 'failed' AND substr(detail, 1, 7) = 'Error: ');
CREATE INDEX IF NOT EXISTS ix_fin_load_retry ON fin_load (retry_after) WHERE retry_after IS NOT NULL;
-- prefetch discovery (every minute) only needs API lists: attachment files and the two list kinds it never reads were
-- left at discovered=0 (daily shareholding XBRL kept arriving that way) and were re-read every minute
UPDATE fetch_job SET discovered = 1
  WHERE status IN ('todo','failed','empty','done') AND discovered = 0 AND (kind IN ('announcements','credit_rating') OR url NOT LIKE 'https://www.nseindia.com/%');
