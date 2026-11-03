-- BSE Ltd shareholding (17 held): category sum accepted as total when NSE's issue size confirms it; in-capmkt prefix read.
DELETE FROM fin_load WHERE status = 'review' AND (detail LIKE 'checks failed: promoter + public%' OR detail LIKE 'not a supported shareholding file%');
