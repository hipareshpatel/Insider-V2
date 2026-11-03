-- D141 cycle 3 (V1 hint #276, record/ex-date): stale Bc ex-dates rejected (true-date factor already applied), MOS no evidence, SALASAR confirmed.
DELETE FROM adj_factor WHERE security_id=1748 AND ex_date='2024-05-17' AND status='review';
DELETE FROM adj_factor WHERE security_id=2058 AND ex_date='2024-08-30' AND status='review';
DELETE FROM adj_factor WHERE security_id=1681 AND ex_date='2024-09-27' AND status='review';
DELETE FROM adj_factor WHERE security_id=866 AND ex_date='2024-09-18' AND status='review';
DELETE FROM adj_factor WHERE security_id=2291 AND ex_date='2026-01-15' AND status='review';
DELETE FROM adj_factor WHERE security_id=4 AND ex_date='2025-09-26' AND status='review';
DELETE FROM adj_factor WHERE security_id=151 AND ex_date='2025-09-26' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=1587 AND ex_date='2024-02-01' AND status='review';
