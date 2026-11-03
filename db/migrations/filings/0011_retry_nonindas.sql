-- Old Indian GAAP tag names now understood: retry files held for missing core lines.
DELETE FROM fin_load WHERE status = 'review' AND detail LIKE 'industrial: core lines missing%';
