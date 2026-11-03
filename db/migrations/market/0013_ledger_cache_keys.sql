-- Owner #265 (track every download): files read from the R2 cache were recorded with raw/... keys that were never
-- written. Every such row came from cache/<url path> (R2 authoritative to 2026-11-02), so point the ledger there.
UPDATE source_file SET r2_key = 'cache' || substr(url, 33)
WHERE url LIKE 'https://nsearchives.nseindia.com/%' AND r2_key LIKE 'raw/%';
