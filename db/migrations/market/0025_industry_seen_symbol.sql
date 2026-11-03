-- D150 fix: NSE announcement rows can carry a stale ISIN (e.g. before a face-value split), 256 ISINs matched no
-- security. Keep the NSE symbol too; classification falls back to the symbol valid on the last sighting.
ALTER TABLE industry_seen ADD COLUMN symbol TEXT;
-- Re-read the 36 announcement lists once to fill the symbol (bookkeeping rows only; no downloaded file is touched).
DELETE FROM sector_file;
