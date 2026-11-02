-- ETFs/fund units (ISIN prefix INF) were loaded before the universe filter (D4, log #253). Remove them; companies untouched.
DELETE FROM price_daily WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM delivery_daily WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM shares_daily WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM corp_action WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM adj_factor WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM security WHERE security_id IN (SELECT DISTINCT security_id FROM security_identifier WHERE id_type='isin' AND value LIKE 'INF%');
DELETE FROM security_identifier WHERE security_id NOT IN (SELECT security_id FROM security);
-- Dates rejected only because of the fund-unit join gap get retried now (their 3-hour retry block is cleared).
DELETE FROM pipeline_run WHERE status = 'failed' AND detail LIKE '%join MCAP%';
