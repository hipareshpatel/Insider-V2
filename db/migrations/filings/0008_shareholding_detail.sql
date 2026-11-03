-- Shareholding loader (M2): ours-vs-filed % and the promoter encumbrance split (FMEA C1–C3).
ALTER TABLE shareholding ADD COLUMN pct_all_shares TEXT;   -- shares ÷ all shares (pct column = filed, SCRR base)
CREATE TABLE promoter_encumbrance (
  filing_id     INTEGER PRIMARY KEY REFERENCES filing(filing_id),
  security_id   INTEGER NOT NULL,
  as_of         TEXT NOT NULL,
  encumbered    INTEGER,
  pledged       INTEGER,
  non_disposal  INTEGER,
  other         INTEGER,
  pct_of_promoter_holding TEXT
);
