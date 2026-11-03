-- Owner #271 (measured): "shares_daily WHERE d = ?" had no index and scanned the whole table on every date
-- (780M rows read in 1.5 days). price_daily already has ix_price_d; shares_daily needs the same. One-off cost:
-- about 1.9M index rows written; then +1 write per share row (~2,800/day).
CREATE INDEX IF NOT EXISTS ix_shares_d ON shares_daily (d);
