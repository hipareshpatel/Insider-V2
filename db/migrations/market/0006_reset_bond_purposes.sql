-- 2026-11-03: reload after bond/debenture purposes were misread as unknown corporate actions (review flood).
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
