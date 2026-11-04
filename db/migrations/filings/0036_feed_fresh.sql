-- Work list item 1 (owner #333, #343): one freshness watermark per feed, written by the loaders (newest disclosure,
-- rows, when) so the freshness check never scans a table. Seeded once from the tables (one read of each; 6 rows written).
CREATE TABLE feed_fresh (
  feed   TEXT PRIMARY KEY,
  newest TEXT,
  rows   INTEGER NOT NULL DEFAULT 0,
  at     TEXT NOT NULL
);
INSERT INTO feed_fresh (feed, newest, rows, at)
  SELECT 'insider_trades', max(disclosed_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM insider_trade WHERE key >= 'pitx:' AND key < 'pitx;';
INSERT INTO feed_fresh (feed, newest, rows, at) SELECT 'sast29', max(disclosed_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM sast_disclosure;
INSERT INTO feed_fresh (feed, newest, rows, at) SELECT 'board_meetings', max(announced_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM board_meeting;
INSERT INTO feed_fresh (feed, newest, rows, at) SELECT 'credit_rating', max(disclosed_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM credit_rating;
INSERT INTO feed_fresh (feed, newest, rows, at) SELECT 'results', max(disclosed_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM filing WHERE kind <> 'shareholding';
INSERT INTO feed_fresh (feed, newest, rows, at) SELECT 'shareholding', max(disclosed_at), count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM filing WHERE kind = 'shareholding';
