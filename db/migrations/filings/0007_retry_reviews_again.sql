-- Items held by the old code in the minute before the C4/C5 fix deployed: retry.
DELETE FROM fin_load WHERE status IN ('review','failed');
