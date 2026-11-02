-- 2026-11-03: data loaded tonight had duplicate securities (dates retried out of order before the
-- extend-back fix). Wipe and reload from NSE's archive; raw files are re-fetchable. Children first (FKs).
DELETE FROM latest_snapshot;
DELETE FROM market_structure;
DELETE FROM index_membership;
DELETE FROM index_daily;
DELETE FROM adj_factor;
DELETE FROM corp_action;
DELETE FROM shares_daily;
DELETE FROM delivery_daily;
DELETE FROM price_daily;
DELETE FROM classification;
DELETE FROM security_identifier;
DELETE FROM security;
DELETE FROM source_file;
DELETE FROM trading_calendar;
DELETE FROM pipeline_run;
DELETE FROM job_lock;
