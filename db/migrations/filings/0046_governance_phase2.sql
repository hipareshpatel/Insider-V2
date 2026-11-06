-- G8 phase 2 (owner approval, log #405): auditors per results filing, board composition per governance filing.
-- HARD RULE (owner): no PAN, DIN or date of birth is stored anywhere — there are no such columns, and the reader
-- (core boardSnapshot) never reads those facts. A director is identified within a company by the normalised name.
--
-- Audit opinion: one fact per results filing, stored in the existing governance_fact (0001: filing_id, security_id,
-- key, value) under key 'audit_opinion' (unmodified / modified / not_applicable) and 'audit_opinion_text' (as filed,
-- ≤ 500 characters). Period and basis are the filing's own (filing row, joined by primary key), so a separate
-- audit_opinion table would only repeat them.

-- Auditor firm(s) named by one results filing (in-capmkt:AuditorsFirmName per AuditorAxis member, filed order).
CREATE TABLE auditor_filing (
  filing_id      INTEGER NOT NULL REFERENCES filing(filing_id),
  security_id    INTEGER NOT NULL,
  basis          TEXT NOT NULL,
  period_end     TEXT NOT NULL,
  seq            INTEGER NOT NULL,          -- 1, 2, … (joint auditors)
  firm           TEXT NOT NULL,             -- as filed
  firm_key       TEXT NOT NULL,             -- core auditorKey(): case, punctuation, '&'/'and', LLP ignored
  peer_review    INTEGER,                   -- 1 / 0 / NULL (not filed)
  cert_valid_to  TEXT,
  PRIMARY KEY (filing_id, seq)
) WITHOUT ROWID;
CREATE INDEX ix_auditor_filing_sec ON auditor_filing (security_id, period_end);

-- Directors on one company's board at one governance period end (in-bse-cg CG_*.xml or Integrated Filing –
-- Governance). One row per director and period; the first file read for a period wins (inserts only).
CREATE TABLE board_member (
  security_id       INTEGER NOT NULL,
  period_end        TEXT NOT NULL,
  name_key          TEXT NOT NULL,          -- core directorKey(): honorifics, case, punctuation ignored
  name              TEXT NOT NULL,          -- as filed (identifier-shaped text removed)
  category          TEXT,                   -- filed category / positions joined by ' / '
  status            TEXT,                   -- filed current status
  appointed_on      TEXT,
  ceased_on         TEXT,
  source_kind       TEXT NOT NULL,          -- 'xbrl_governance' / 'xbrl_integrated_governance'
  filing_or_job_id  INTEGER NOT NULL,       -- fetch_job.job_id of the file (governance files have no filing row)
  PRIMARY KEY (security_id, period_end, name_key)
) WITHOUT ROWID;

-- One row per governance file read (also files naming no director): what was read, and the investor complaints
-- pending at the period end when the file carries them.
CREATE TABLE governance_filing (
  security_id         INTEGER NOT NULL,
  period_end          TEXT NOT NULL,
  source_kind         TEXT NOT NULL,
  job_id              INTEGER NOT NULL,
  directors           INTEGER NOT NULL,
  complaints_pending  INTEGER,
  read_at             TEXT NOT NULL,
  PRIMARY KEY (security_id, period_end, source_kind, job_id)
) WITHOUT ROWID;
