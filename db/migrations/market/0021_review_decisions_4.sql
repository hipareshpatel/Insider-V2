-- D141 cycle 4 (owner #278: web search): ETF unit splits confirmed from NSE circulars; duplicates superseded; POLICYBZR real move; QUINT/NTPC no adjustment; resolution-plan capital reductions and Tata Coffee = series break (D146).
UPDATE adj_factor SET status='confirmed' WHERE security_id=44 AND ex_date='2024-03-01' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=76 AND ex_date='2024-03-01' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=218 AND ex_date='2024-03-01' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=311 AND ex_date='2024-03-01' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=235 AND ex_date='2024-02-02' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=297 AND ex_date='2024-02-02' AND status='review';
DELETE FROM adj_factor WHERE security_id=2238 AND ex_date='2024-01-12' AND status='review';
DELETE FROM adj_factor WHERE security_id=509 AND ex_date='2024-01-24' AND status='review';
DELETE FROM adj_factor WHERE security_id=1672 AND ex_date='2024-08-16' AND status='review';
DELETE FROM adj_factor WHERE security_id=2239 AND ex_date='2024-10-18' AND status='review';
DELETE FROM adj_factor WHERE security_id=483 AND ex_date='2025-02-21' AND status='review';
DELETE FROM adj_factor WHERE security_id=2112 AND ex_date='2026-01-02' AND status='review';
DELETE FROM adj_factor WHERE security_id=2299 AND ex_date='2024-11-22' AND status='review';
DELETE FROM adj_factor WHERE security_id=1341 AND ex_date='2024-01-15' AND status='review';
