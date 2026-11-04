-- Owner #339: NSE's DUMMY… symbols are corporate-action test instruments, not companies. Re-marked 'other' (outside the
-- universe, statistics, sectors and the site); their stored rows stay (nothing downloaded is deleted, #282).
UPDATE security SET kind = 'other'
WHERE security_id IN (SELECT security_id FROM security_identifier WHERE id_type = 'nse_symbol' AND upper(value) LIKE 'DUMMY%');
