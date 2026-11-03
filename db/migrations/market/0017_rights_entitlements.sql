-- Rights entitlements (company ISIN security-type 20, symbols "-RE") are not shares: 145 of 219 adjusted-series
-- jumps > ±35% were these instruments (normal: ~40% daily bands near expiry). Kept (D127) as kind 'other'.
UPDATE security SET kind = 'other'
WHERE kind = 'equity' AND security_id IN (
  SELECT security_id FROM security_identifier WHERE id_type = 'isin' AND value LIKE 'INE%' AND substr(value, 8, 2) = '20');
