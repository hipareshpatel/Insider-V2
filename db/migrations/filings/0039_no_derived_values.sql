-- Owner #347: every number in fin_value is a filed fact (XBRL cell, or a PDF cell with origin 'extracted'). The
-- table CHECK still lists 'computed' (changing it would rebuild a ~2M-row table, forbidden); these triggers refuse it
-- instead, on insert and on update. No rows are read or written by this migration.
CREATE TRIGGER IF NOT EXISTS fin_value_no_derived_insert BEFORE INSERT ON fin_value
WHEN NEW.origin NOT IN ('reported', 'extracted')
BEGIN SELECT RAISE(ABORT, 'fin_value: derived figures are never stored (owner #347)'); END;
CREATE TRIGGER IF NOT EXISTS fin_value_no_derived_update BEFORE UPDATE OF origin ON fin_value
WHEN NEW.origin NOT IN ('reported', 'extracted')
BEGIN SELECT RAISE(ABORT, 'fin_value: derived figures are never stored (owner #347)'); END;
