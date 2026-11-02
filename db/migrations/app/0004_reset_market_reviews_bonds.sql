-- 2026-11-03: review items raised from the market data wiped in market/0004. They will be raised again on reload.
DELETE FROM review_item WHERE subject_db = 'market';
