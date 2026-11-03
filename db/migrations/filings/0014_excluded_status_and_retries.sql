-- Item 4 batch (D140): (1) 'excluded' status for files the reader rules out (D145: old bank-format files with no
-- reporting period in the file); SQLite cannot alter a CHECK, so the small table is rebuilt.
CREATE TABLE fin_load_new (
  job_id      INTEGER PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('loaded','review','skipped','failed','excluded')),
  filing_id   INTEGER,
  detail      TEXT,
  at          TEXT NOT NULL
);
INSERT INTO fin_load_new (job_id, status, filing_id, detail, at) SELECT job_id, status, filing_id, detail, at FROM fin_load;
DROP TABLE fin_load;
ALTER TABLE fin_load_new RENAME TO fin_load;
CREATE INDEX ix_fin_load_status ON fin_load (status);
-- (2) retry the classes this batch fixes: no-period files (→ excluded), missing core lines (alias proven by sums),
-- scale-guard holds (median of the 4 nearest periods); held anchors are rebuilt as files are re-read.
-- D1 limits LIKE patterns to 50 bytes (FMEA A9, C35): long matches use instr().
DELETE FROM fin_load WHERE status = 'review' AND (instr(detail, 'reporting period not found') > 0 OR detail LIKE 'industrial: core lines missing%' OR detail LIKE 'scale guard%');
DELETE FROM fin_held;
