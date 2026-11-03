-- Site v0 (M3): the stock page reads a company's latest shareholding; without this index every view scanned the
-- whole shareholding table (D1 rows read on each uncached page view).
CREATE INDEX ix_shareholding_sec ON shareholding (security_id, as_of);
