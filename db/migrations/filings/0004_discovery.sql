-- D128: attachments (XBRL on the archive host) discovered from downloaded lists; fetched by a GitHub runner.
ALTER TABLE fetch_job ADD COLUMN discovered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fetch_job ADD COLUMN parent_id INTEGER;
CREATE INDEX ix_fetch_discover ON fetch_job (status, discovered);
