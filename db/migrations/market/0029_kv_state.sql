-- Audit P1: small key/value state for market cursors (first: the sector job's position in the download ledger, so it
-- no longer lists R2 and reads all of sector_file every 10 minutes).
CREATE TABLE kv_state (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
