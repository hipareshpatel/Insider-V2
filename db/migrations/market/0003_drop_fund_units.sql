-- ETFs/fund units (ISIN prefix INF) were loaded before the universe filter (D4, D126). Remove them; companies untouched.
-- Order matters: D1 enforces foreign keys (children first, security last).
CREATE TABLE _drop_ids AS SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%';
DELETE FROM price_daily WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM delivery_daily WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM shares_daily WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM adj_factor WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM corp_action WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM classification WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM index_membership WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM market_structure WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM latest_snapshot WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM security_identifier WHERE security_id IN (SELECT security_id FROM _drop_ids);
DELETE FROM security WHERE security_id IN (SELECT security_id FROM _drop_ids);
DROP TABLE _drop_ids;
-- Dates rejected only because of the fund-unit join gap get retried now (their 3-hour retry block is cleared).
DELETE FROM pipeline_run WHERE status = 'failed' AND detail LIKE '%join MCAP%';
