-- Field catalogue §3 (bulk_block_deals_90d): one security's deals over 90 days by symbol and date range. The primary
-- key leads with (kind, d), so without this every deal of the window would be read once per company. Adds an index only.
CREATE INDEX IF NOT EXISTS ix_deal_symbol ON deal (symbol, d);
