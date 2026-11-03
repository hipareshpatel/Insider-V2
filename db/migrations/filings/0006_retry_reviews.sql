-- FMEA C4/C5 fixes: retry results files held for review under the new code.
DELETE FROM fin_load WHERE status IN ('review','failed');
