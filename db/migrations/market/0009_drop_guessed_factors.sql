-- Price-ratio guesses written for purposes that weren't understood (e.g. dividend combinations) are removed; real demergers are re-proposed on reload of that date if needed.
DELETE FROM adj_factor WHERE status='review' AND method='price_ratio' AND (security_id, ex_date) NOT IN (SELECT security_id, ex_date FROM corp_action WHERE type IN ('demerger','capital_reduction'));
