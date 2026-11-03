-- FMEA C7: retry files held only because their expense breakdown doesn't add up.
DELETE FROM fin_load WHERE status = 'review' AND detail LIKE 'checks failed: expense lines = total expenses (%' AND detail NOT LIKE '%;%';
