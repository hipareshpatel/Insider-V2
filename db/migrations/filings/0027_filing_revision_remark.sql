-- Owner #334: NSE's submission type ("Original" / "Revision") and revision remark per filing (e.g. Union Bank Q4 FY26,
-- 29 Sep 2026: "Informed by BSE to insert the figures of cash and cash equivalents ... at beginning of period").
ALTER TABLE filing ADD COLUMN submission TEXT;
ALTER TABLE filing ADD COLUMN revision_remark TEXT;
