-- Census 2026-11-03 (D134): the decimal reader now accepts exponent form ("1.83025364E+15"); retry those files.
DELETE FROM fin_load WHERE status = 'review' AND detail LIKE '%not a decimal%';
