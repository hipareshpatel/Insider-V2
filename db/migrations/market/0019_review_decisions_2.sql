-- D141 cycle 2: Bc-ratio items whose stock didn't trade on the ex-date; ratio matched on the first trading day after.
UPDATE adj_factor SET status='confirmed' WHERE security_id=359 AND ex_date='2025-02-14' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=4 AND ex_date='2025-10-10' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=2543 AND ex_date='2025-10-10' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=2517 AND ex_date='2025-10-08' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=230 AND ex_date='2026-08-24' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=2543 AND ex_date='2024-09-20' AND status='review';
UPDATE adj_factor SET status='confirmed' WHERE security_id=2543 AND ex_date='2025-05-30' AND status='review';
