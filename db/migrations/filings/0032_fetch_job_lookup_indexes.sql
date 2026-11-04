-- 4 Nov: lookups by r2_key (1,824 calls read 562M rows) and by symbol had no index. One-time build reads the table once.
CREATE INDEX IF NOT EXISTS ix_fetch_r2key ON fetch_job (r2_key);
CREATE INDEX IF NOT EXISTS ix_fetch_symbol_kind ON fetch_job (symbol, kind);
