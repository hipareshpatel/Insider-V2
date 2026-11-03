-- Site v0 (M3): precomputed answers for the heavy whole-market pages (dashboard), written every 10 minutes by
-- disclo-web's schedule, so a visitor's request is one row read (performance targets).
CREATE TABLE site_cache (
  key   TEXT PRIMARY KEY,
  body  TEXT NOT NULL,
  at    TEXT NOT NULL
);
